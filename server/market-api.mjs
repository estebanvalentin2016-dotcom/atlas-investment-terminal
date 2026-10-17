const HOST='https://data.alpaca.markets/v2/stocks/';
export function normalizeBars(body){
 if(!Array.isArray(body?.bars))throw new Error('Unexpected market data response');
 return body.bars.filter(x=>typeof x.t==='string'&&[x.o,x.h,x.l,x.c,x.v].every(n=>Number.isFinite(n)&&n>=0)&&x.c>0).map(x=>({date:x.t.slice(0,10),open:x.o,high:x.h,low:x.l,close:x.c,volume:x.v})).sort((a,b)=>a.date.localeCompare(b.date));
}
export function dailyMomentum(bars){
 if(!Array.isArray(bars)||bars.length<21)return null;
 const latest=bars.at(-1);if(!latest||latest.close<=0)return null;
 const ret=n=>{const prior=bars.at(-(n+1));return prior?.close>0?(latest.close/prior.close-1)*100:null};
 const prior20=bars.slice(-21,-1),mean=prior20.reduce((sum,b)=>sum+b.volume,0)/20;
 const high20=Math.max(...bars.slice(-20).map(b=>b.high));
 return {date:latest.date,close:latest.close,volume:latest.volume,day1:ret(1),day3:ret(3),day5:ret(5),rvol:mean>0?latest.volume/mean:null,below20DayHighPct:high20>0?(latest.close/high20-1)*100:null};
}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
export async function handleMarketRequest(req,res){
 const u=new URL(req.url,'http://localhost');if(!['/api/market/daily','/api/market/event'].includes(u.pathname))return false;
 if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return true}
 const ticker=(u.searchParams.get('ticker')||'').trim().toUpperCase();
 if(!/^[A-Z0-9.-]{1,12}$/.test(ticker)){json(res,400,{error:'Invalid ticker'});return true}
 const key=process.env.ALPACA_API_KEY_ID,secret=process.env.ALPACA_API_SECRET_KEY;
 if(!key||!secret){json(res,503,{error:'Free Alpaca market data is not configured. See MARKET_DATA.md'});return true}
 try{
  const eventMode=u.pathname==='/api/market/event';
  const eventDate=u.searchParams.get('eventDate');
  if(eventMode&&(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate||'')||new Date(eventDate+'T00:00:00Z').toISOString().slice(0,10)!==eventDate)){json(res,400,{error:'Valid eventDate (YYYY-MM-DD) required'});return true}
  const eventMs=eventMode?Date.parse(eventDate+'T00:00:00Z'):null;
  if(eventMode&&(eventMs>Date.now()||eventMs<Date.now()-180*86400000)){json(res,400,{error:'Event is outside the supported recent 180-day historical window'});return true}
  const end=eventMode?new Date(Math.min(Date.now()-20*60*1000,eventMs+16*86400000)).toISOString():new Date(Date.now()-20*60*1000).toISOString();
  const start=eventMode?new Date(eventMs-14*86400000).toISOString():new Date(Date.now()-160*86400000).toISOString();
  const target=new URL(HOST+encodeURIComponent(ticker)+'/bars');
  target.searchParams.set('timeframe','1Day');target.searchParams.set('start',start);target.searchParams.set('end',end);target.searchParams.set('feed','iex');target.searchParams.set('limit','200');target.searchParams.set('adjustment',eventMode?'split':'raw');
  const r=await fetch(target,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,'Accept':'application/json'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error('Alpaca market data returned HTTP '+r.status);
  const body=await r.json();const allBars=normalizeBars(body);
  // No incomplete current-day session enters event results, even if the provider returns it.
  const todayParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const dayPart=Object.fromEntries(todayParts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const easternToday=dayPart.year+'-'+dayPart.month+'-'+dayPart.day;
  const bars=eventMode?allBars.filter(b=>b.date<easternToday):allBars;
  json(res,200,{ticker,provider:'Alpaca',feed:'IEX',adjustment:eventMode?'split':'raw',retrievedAt:new Date().toISOString(),bars,summary:eventMode?null:dailyMomentum(bars),partialHistory:Boolean(body.next_page_token),completedSessionsOnly:eventMode});
 }catch(e){json(res,502,{error:e instanceof Error?e.message:'Market data unavailable'})}
 return true;
}
