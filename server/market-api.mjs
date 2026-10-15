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
const valuationCache=new Map();
export function mostRecentCompletedDaily(bars,asofDate,maxAgeDays=10){
 const list=bars.filter(x=>x.date<asofDate).sort((a,b)=>b.date.localeCompare(a.date));
 const latest=list[0]||null;
 if(!latest)return null;
 const age=(Date.parse(asofDate+'T00:00:00Z')-Date.parse(latest.date+'T00:00:00Z'))/86400000;
 return Number.isFinite(age)&&age>=0&&age<=maxAgeDays?latest:null;
}
// This is observed Alpaca IEX activity, never consolidated exchange volume
// or a tradability/float/spread assessment. Exclude today's incomplete bar.
export function iexCompletedLiquidity(bars,asofDate){
 const completed=bars.filter(b=>b.date<asofDate&&Number.isFinite(b.volume)&&b.volume>0&&Number.isFinite(b.close)&&b.close>0).sort((a,b)=>a.date.localeCompare(b.date));
 const selected=completed.slice(-20);
 if(selected.length!==20||new Set(selected.map(b=>b.date)).size!==20)return null;
 const totalShares=selected.reduce((sum,b)=>sum+b.volume,0);
 const totalDollars=selected.reduce((sum,b)=>sum+b.volume*b.close,0);
 if(!Number.isFinite(totalDollars)||totalShares<=0)return null;
 return {sessionCount:20,startDate:selected[0].date,endDate:selected[19].date,
  avgDailyIexShares:Math.round(totalShares/20),
  avgDailyIexDollarVolume:Math.round(totalDollars/20),
  coverage:'Alpaca IEX only, not consolidated volume, free float or bid-ask spread'};
}
export async function handleValuationPriceRequest(req,res){
 const u=new URL(req.url,'http://localhost');
 if(u.pathname!=='/api/market/valuation-close')return false;
 if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return true}
 const ticker=(u.searchParams.get('ticker')||'').trim().toUpperCase();
 if(!/^[A-Z0-9.-]{1,12}$/.test(ticker)){json(res,400,{error:'Invalid ticker'});return true}
 const key=process.env.ALPACA_API_KEY_ID,secret=process.env.ALPACA_API_SECRET_KEY;
 if(!key||!secret){json(res,503,{error:'Alpaca IEX market data not configured'});return true}
 const prior=valuationCache.get(ticker);
 if(prior&&Date.now()-prior.at<10*60000){json(res,200,prior.body);return true}
 try{
  const now=Date.now();
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
  const dateParts=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const easternToday=dateParts.year+'-'+dateParts.month+'-'+dateParts.day;
  const start=new Date(now-50*86400000).toISOString();
  const end=new Date(now-20*60000).toISOString();
  const target=new URL(HOST+encodeURIComponent(ticker)+'/bars');
  for(const [name,val] of Object.entries({timeframe:'1Day',start,end,feed:'iex',limit:'80',adjustment:'raw'}))target.searchParams.set(name,val);
  const upstream=await fetch(target,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!upstream.ok){json(res,502,{error:'Alpaca valuation close HTTP '+upstream.status});return true}
  const incoming=await upstream.json();
  const bars=normalizeBars(incoming);
  // Ignore today's session entirely, including after hours. Never mix a
  // partial IEX bar with SEC annual EPS and call it an intraday P/E.
  const quote=mostRecentCompletedDaily(bars,easternToday);
  if(!quote){json(res,503,{error:'No recent completed IEX trading session is available'});return true}
  const body={ticker,price:quote.close,sessionDate:quote.date,feed:'IEX',provider:'Alpaca',adjustment:'raw',completedSession:true,splitValidation:'unverified',iex20:iexCompletedLiquidity(bars,easternToday),retrievedAt:new Date().toISOString()};
  valuationCache.set(ticker,{at:Date.now(),body});
  if(valuationCache.size>80)valuationCache.clear();
  json(res,200,body);
 }catch(e){json(res,502,{error:e instanceof Error?e.message:'Valuation close unavailable'})}
 return true;
}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
export async function handleMarketRequest(req,res){
 const u=new URL(req.url,'http://localhost');if(!['/api/market/daily','/api/market/event','/api/market/long-history'].includes(u.pathname))return false;
 if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return true}
 const ticker=(u.searchParams.get('ticker')||'').trim().toUpperCase();
 if(!/^[A-Z0-9.-]{1,12}$/.test(ticker)){json(res,400,{error:'Invalid ticker'});return true}
 const key=process.env.ALPACA_API_KEY_ID,secret=process.env.ALPACA_API_SECRET_KEY;
 if(!key||!secret){json(res,503,{error:'Free Alpaca market data is not configured. See MARKET_DATA.md'});return true}
 try{
  if(u.pathname==='/api/market/long-history'){
   const now=Date.now();
   const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
   const date=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
   const monday=new Date(date.year+'-'+date.month+'-'+date.day+'T00:00:00Z');
   monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
   const currentWeek=monday.toISOString().slice(0,10);
   const target=new URL(HOST+encodeURIComponent(ticker)+'/bars');
   for(const [name,value] of Object.entries({timeframe:'1Week',start:new Date(now-11*365.25*86400000).toISOString(),end:new Date(now-20*60000).toISOString(),feed:'iex',adjustment:'split',limit:'1000',sort:'asc'}))target.searchParams.set(name,value);
   const history=[];let token=null;let partial=false;
   for(let page=0;page<4;page++){
    if(token)target.searchParams.set('page_token',token);
    const response=await fetch(target,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Alpaca IEX history HTTP '+response.status);
    const body=await response.json();
    history.push(...normalizeBars(body).filter(b=>b.date<currentWeek));
    token=typeof body.next_page_token==='string'&&body.next_page_token?body.next_page_token:null;
    if(!token)break;
    if(page===3)partial=true;
   }
   const unique=new Map(history.map(bar=>[bar.date,{date:bar.date,close:bar.close}]));
   const bars=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date));
   if(!bars.length)throw Error('No completed split-adjusted weekly IEX bars available');
   json(res,200,{ticker,provider:'Alpaca',feed:'IEX',timeframe:'1Week',adjustment:'split',completedWeeksOnly:true,requestedYears:11,partialHistory:partial,retrievedAt:new Date().toISOString(),coverageStart:bars[0].date,coverageEnd:bars.at(-1).date,bars,note:'Weekly split-adjusted IEX price history; dividends excluded. First bar is not a verified IPO date.'});
   return true;
  }
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
