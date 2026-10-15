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
 const u=new URL(req.url,'http://localhost');if(u.pathname!=='/api/market/daily')return false;
 if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return true}
 const ticker=(u.searchParams.get('ticker')||'').trim().toUpperCase();
 if(!/^[A-Z0-9.-]{1,12}$/.test(ticker)){json(res,400,{error:'Invalid ticker'});return true}
 const key=process.env.ALPACA_API_KEY_ID,secret=process.env.ALPACA_API_SECRET_KEY;
 if(!key||!secret){json(res,503,{error:'Free Alpaca market data is not configured. See MARKET_DATA.md'});return true}
 try{
  const end=new Date(Date.now()-20*60*1000).toISOString();
  const start=new Date(Date.now()-160*86400000).toISOString();
  const target=new URL(HOST+encodeURIComponent(ticker)+'/bars');
  target.searchParams.set('timeframe','1Day');target.searchParams.set('start',start);target.searchParams.set('end',end);target.searchParams.set('feed','iex');target.searchParams.set('limit','200');target.searchParams.set('adjustment','raw');
  const r=await fetch(target,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,'Accept':'application/json'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error('Alpaca market data returned HTTP '+r.status);
  const body=await r.json();const bars=normalizeBars(body);
  json(res,200,{ticker,provider:'Alpaca',feed:'IEX',adjustment:'raw',retrievedAt:new Date().toISOString(),bars,summary:dailyMomentum(bars),partialHistory:Boolean(body.next_page_token)});
 }catch(e){json(res,502,{error:e instanceof Error?e.message:'Market data unavailable'})}
 return true;
}
