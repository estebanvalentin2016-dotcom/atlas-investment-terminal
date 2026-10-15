// SEC daily master indexes are market-wide filing discovery, not sentiment or financial evaluation.
export function parseMasterIndex(text,date,tickers){
 if(typeof text!=='string'||!Array.isArray(tickers))throw Error('Invalid index response');
 const cikMap=new Map(tickers.filter(t=>Number.isSafeInteger(Number(t.cik_str))&&typeof t.ticker==='string').map(t=>[String(Number(t.cik_str)),t]));
 const rows=[];
 for(const line of text.split(/\r?\n/)){
  const match=line.match(/^(\d+)\|([^|]+)\|(8-K(?:\/A)?)\|(\d{4}-\d{2}-\d{2})\|(edgar\/data\/\d+\/[^\s|]+\.txt)$/);
  if(!match)continue;
  const [,cik,name,form,filed,relative]=match;
  if(filed!==date)continue;
  const matchTicker=cikMap.get(String(Number(cik)));
  if(!matchTicker)continue;
  rows.push({ticker:matchTicker.ticker,name:matchTicker.title||name,form,filed,url:'https://www.sec.gov/Archives/'+relative,cik,kind:'8-K (contents unreviewed)'});
 }
 return rows;
}
export function rankFreshFilings(rows,limit=40){
 const unique=new Map();
 for(const r of rows){
  if(!r?.url||!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(r.url))continue;
  unique.set(r.url,r);
 }
 return [...unique.values()].sort((a,b)=>b.filed.localeCompare(a.filed)||a.ticker.localeCompare(b.ticker)).slice(0,limit);
}
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))};
let cache=null;
export async function handleWideDiscovery(req,res){
 const u=new URL(req.url,'http://localhost');
 if(u.pathname!=='/api/opportunities/sec-wide')return false;
 if(req.method!=='GET'){send(res,405,{error:'Method not allowed'});return true}
 const agent=process.env.SEC_USER_AGENT;
 if(!agent||!agent.includes('@')){send(res,503,{error:'SEC_USER_AGENT not configured'});return true}
 if(cache&&Date.now()-cache.at<10*60000){send(res,200,cache.body);return true}
 const errors=[],found=[];let successfulDays=0;
 try{
  const headers={'User-Agent':agent,Accept:'text/plain,application/json'};
  const meta=await fetch('https://www.sec.gov/files/company_tickers.json',{headers,signal:AbortSignal.timeout(12000)});
  if(!meta.ok)throw Error('SEC ticker index HTTP '+meta.status);
  const symbols=Object.values(await meta.json());
  // Recent seven calendar days, strictly public daily indexes. Weekends/holidays may not exist.
  const now=new Date(),today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  for(let offset=0;offset<7;offset++){
   const d=new Date(today-offset*86400000);
   const day=d.toISOString().slice(0,10),quarter=Math.floor(d.getUTCMonth()/3)+1;
   const yyyy=d.getUTCFullYear(),compact=day.replaceAll('-','');
   const url='https://www.sec.gov/Archives/edgar/daily-index/'+yyyy+'/QTR'+quarter+'/master.'+compact+'.idx';
   try{
    const r=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});
    if(r.status===404)continue;
    if(!r.ok){errors.push(day+': SEC HTTP '+r.status);continue}
    successfulDays++;
    found.push(...parseMasterIndex(await r.text(),day,symbols));
   }catch(e){errors.push(day+': '+(e instanceof Error?e.message:'Feed failed'))}
  }
  if(!successfulDays)throw Error('No SEC daily indexes could be retrieved. '+errors.join('; '));
  const body={retrievedAt:new Date().toISOString(),lookbackCalendarDays:7,successfulDays,errorDays:errors,matchedFilings:found.length,rows:rankFreshFilings(found),scope:'SEC daily master index, publicly indexed tickers only',note:'Master indexes supply filing dates, not exact public release times, sentiment, item numbers, bullishness or market prices.'};
  cache={at:Date.now(),body};send(res,200,body);
 }catch(e){send(res,502,{error:e instanceof Error?e.message:'SEC-wide discovery unavailable',errorDays:errors})}
 return true;
}
