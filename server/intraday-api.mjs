// On-demand historical 15-minute IEX availability probe; no implied execution prices.
const HOST='https://data.alpaca.markets/v2/stocks/';
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))};
export function marketClock(iso){
 const date=new Date(iso);
 if(!Number.isFinite(date.getTime()))return null;
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return {date:p.year+'-'+p.month+'-'+p.day,minutes:Number(p.hour)*60+Number(p.minute)};
}
export function summarizeIntraday(body,session){
 if(!Array.isArray(body?.bars))throw Error('Unexpected intraday provider response');
 const seen=new Set(),bars=[];
 for(const b of body.bars){
  const local=typeof b.t==='string'?marketClock(b.t):null;
  if(!local||local.date!==session||local.minutes<570||local.minutes>=960||seen.has(b.t))continue;
  if(![b.o,b.h,b.l,b.c,b.v].every(x=>Number.isFinite(x)&&x>=0)||b.o<=0||b.c<=0||b.h<b.l)continue;
  seen.add(b.t);bars.push({timestamp:b.t,timeEt:String(Math.floor(local.minutes/60)).padStart(2,'0')+':'+String(local.minutes%60).padStart(2,'0'),open:b.o,high:b.h,low:b.l,close:b.c,volume:b.v});
 }
 bars.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
 return {bars,barCount:bars.length,firstBarTimeEt:bars[0]?.timeEt??null,lastBarTimeEt:bars.at(-1)?.timeEt??null,fullRegularSession:bars.length===26&&bars[0]?.timeEt==='09:30'&&bars.at(-1)?.timeEt==='15:45',partialHistory:Boolean(body.next_page_token)};
}
export async function handleIntradayRequest(req,res){
 const u=new URL(req.url,'http://localhost');
 if(u.pathname!=='/api/market/intraday-availability')return false;
 if(req.method!=='GET'){send(res,405,{error:'Method not allowed'});return true}
 const ticker=(u.searchParams.get('ticker')||'').toUpperCase().trim();
 const date=u.searchParams.get('session')||'';
 if(!/^[A-Z0-9.-]{1,12}$/.test(ticker)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date){send(res,400,{error:'Invalid ticker or session date'});return true}
 const ms=Date.parse(date+'T00:00:00Z');
 if(ms>=Date.now()||ms<Date.now()-180*86400000){send(res,400,{error:'Session outside supported past 180 days'});return true}
 const key=process.env.ALPACA_API_KEY_ID,secret=process.env.ALPACA_API_SECRET_KEY;
 if(!key||!secret){send(res,503,{error:'Alpaca credentials unavailable'});return true}
 try{
  const target=new URL(HOST+encodeURIComponent(ticker)+'/bars');
  target.searchParams.set('timeframe','15Min');
  target.searchParams.set('start',date+'T12:00:00Z');
  target.searchParams.set('end',new Date(ms+86400000).toISOString());
  target.searchParams.set('feed','iex');target.searchParams.set('adjustment','split');target.searchParams.set('limit','1000');
  const response=await fetch(target,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret},signal:AbortSignal.timeout(12000)});
  if(!response.ok){send(res,502,{error:'Alpaca intraday query returned HTTP '+response.status});return true}
  const summary=summarizeIntraday(await response.json(),date);
  send(res,200,{ticker,session:date,feed:'IEX',timeframe:'15Min',adjustment:'split',retrievedAt:new Date().toISOString(),...summary});
 }catch(e){send(res,502,{error:e instanceof Error?e.message:'Intraday data unavailable'})}
 return true;
}
