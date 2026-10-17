// Overnight BOATS research probe. Alpaca data NEVER proves Robinhood eligibility or fills.
const respond=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
export function overnightClock(iso){
 const d=new Date(iso);if(!Number.isFinite(d.getTime()))return null;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return {date:parts.year+'-'+parts.month+'-'+parts.day,minute:Number(parts.hour)*60+Number(parts.minute)};
}
export function overnightSummary(body,date){
 if(!Array.isArray(body?.bars))throw Error('Unexpected overnight data response');
 const raw=body.bars.filter(b=>{
  const c=typeof b.t==='string'?overnightClock(b.t):null;
  return c&&c.date===date&&c.minute>=0&&c.minute<240&&[b.o,b.h,b.l,b.c,b.v].every(x=>Number.isFinite(x)&&x>=0)&&b.o>0&&b.c>0&&b.h>=Math.max(b.o,b.c,b.l)&&b.l<=Math.min(b.o,b.c);
 }).sort((a,b)=>a.t.localeCompare(b.t));
 const near=raw.filter(b=>{const x=overnightClock(b.t);return x.minute>=105&&x.minute<135});
 return {barCount:raw.length,near2amBars:near.length,observed2amWindow:near.map(b=>({timeEt:overnightClock(b.t).minute,open:b.o,high:b.h,low:b.l,close:b.c,volume:b.v})),firstBar:raw[0]?.t??null,lastBar:raw.at(-1)?.t??null,partialHistory:Boolean(body.next_page_token),robinhoodHistoricalEligibility:'Unknown',executionPrice:'Unknown'};
}
export async function handleOvernightRequest(req,res){
 const u=new URL(req.url,'http://localhost');if(u.pathname!=='/api/market/overnight-probe')return false;
 if(req.method!=='GET'){respond(res,405,{error:'Method not allowed'});return true}
 const ticker=(u.searchParams.get('ticker')||'').trim().toUpperCase(),date=u.searchParams.get('session')||'';
 if(!/^[A-Z0-9.-]{1,12}$/.test(ticker)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date){respond(res,400,{error:'Invalid ticker or session date'});return true}
 const day=Date.parse(date+'T00:00:00Z');
 if(day>=Date.now()||day<Date.now()-180*86400000){respond(res,400,{error:'Outside supported past 180 days'});return true}
 const key=process.env.ALPACA_API_KEY_ID,secret=process.env.ALPACA_API_SECRET_KEY;
 if(!key||!secret){respond(res,503,{error:'Alpaca market-data credentials not configured'});return true}
 try{
  // Query generous UTC range covering 00:00-04:00 ET in both EST and EDT.
  const url=new URL('https://data.alpaca.markets/v2/stocks/'+encodeURIComponent(ticker)+'/bars');
  url.searchParams.set('timeframe','15Min');url.searchParams.set('feed','boats');url.searchParams.set('adjustment','split');
  url.searchParams.set('start',new Date(day+3*3600000).toISOString());
  url.searchParams.set('end',new Date(day+11*3600000).toISOString());
  url.searchParams.set('limit','1000');
  const r=await fetch(url,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret},signal:AbortSignal.timeout(12000)});
  if(!r.ok){respond(res,200,{ticker,session:date,feed:'BOATS',status:'Unavailable',reason:'Alpaca BOATS historical request returned HTTP '+r.status,robinhoodHistoricalEligibility:'Unknown',executionPrice:'Unknown'});return true}
  const data=overnightSummary(await r.json(),date);
  respond(res,200,{ticker,session:date,feed:'BOATS',status:data.barCount?'Observed trades aggregated into bars':'No eligible observations returned',...data});
 }catch(e){respond(res,502,{error:e instanceof Error?e.message:'Overnight data request failed'})}
 return true;
}
