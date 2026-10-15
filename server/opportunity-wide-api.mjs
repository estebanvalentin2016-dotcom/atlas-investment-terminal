// SEC daily master indexes are market-wide filing discovery, not sentiment or financial evaluation.
export function parseMasterIndex(text,date,tickers){
 if(typeof text!=='string'||!Array.isArray(tickers))throw Error('Invalid index response');
 const cikMap=new Map(tickers.filter(t=>Number.isSafeInteger(Number(t.cik_str))&&typeof t.ticker==='string').map(t=>[String(Number(t.cik_str)),t]));
 const rows=[];
 if(!text.includes('CIK')||!text.includes('Form Type')||!text.includes('Filename'))throw Error('Unrecognized SEC master index header');
 for(const line of text.split(/\r?\n/)){
  const fields=line.split('|').map(x=>x.trim());
  if(fields.length!==5)continue;
  const [cik,name,form,filed,relative]=fields;
  if(!/^\d+$/.test(cik)||!['8-K','8-K/A'].includes(form)||filed!==date||!/^edgar\/data\/\d+\/[\w.\/-]+\.txt$/.test(relative)||relative.includes('..'))continue;
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
const FALLBACK=['CRWD','NVDA','MSFT','AMZN','META','GOOGL','PLTR','AVGO','TSLA','AMD','MU','ORCL','CRM','ADBE','INTC','NFLX','AAPL','PANW','NET','SNOW','DDOG','NOW','UBER','COIN','RKLB','MS','BLK','FLEX','OKLO','SMR'];
export function recentSubmissions(data,ticker,now=Date.now()){
 const x=data?.filings?.recent,rows=[];
 if(!Array.isArray(x?.form))return rows;
 for(let i=0;i<x.form.length;i++){
  if(!['8-K','8-K/A'].includes(x.form[i]))continue;
  const filed=x.filingDate?.[i],accession=x.accessionNumber?.[i],when=Date.parse(filed+'T00:00:00Z');
  if(!Number.isFinite(when)||when>now||when<now-7*86400000||!/^\d{10}-\d{2}-\d{6}$/.test(accession))continue;
  const cik=Number(data.cik);if(!Number.isSafeInteger(cik)||cik<1)continue;
  rows.push({ticker,name:data.name||ticker,form:x.form[i],filed,url:'https://www.sec.gov/Archives/edgar/data/'+cik+'/'+accession.replaceAll('-','')+'/'+accession+'.txt',cik:String(cik),kind:'8-K (contents unreviewed)'});
 }
 return rows;
}
export function summarizeSubmissions(data,ticker,now=Date.now()){
 const recent=data?.filings?.recent;
 const forms=Array.isArray(recent?.form)?recent.form:[];
 const dates=Array.isArray(recent?.filingDate)?recent.filingDate:[];
 const validDates=dates.filter(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x));
 const eightKDates=forms.flatMap((form,i)=>['8-K','8-K/A'].includes(form)&&validDates.includes(dates[i])?[dates[i]]:[]);
 return {ticker,latestFiling:validDates.sort().at(-1)||null,latest8K:eightKDates.sort().at(-1)||null,returnedRows:forms.length,matchingRecent8K:recentSubmissions(data,ticker,now).length};
}
export async function handleWideDiscovery(req,res){
 const u=new URL(req.url,'http://localhost');
 if(u.pathname!=='/api/opportunities/sec-wide')return false;
 if(req.method!=='GET'){send(res,405,{error:'Method not allowed'});return true}
 const agent=process.env.SEC_USER_AGENT;
 if(!agent||!agent.includes('@')){send(res,503,{error:'SEC_USER_AGENT not configured'});return true}
 if(cache&&Date.now()-cache.at<10*60000){send(res,200,cache.body);return true}
 const errors=[],found=[],diagnostics=[],fallbackDiagnostics=[];let successfulDays=0;
 try{
  const headers={'User-Agent':agent,Accept:'text/plain,application/json'};
  const meta=await fetch('https://www.sec.gov/files/company_tickers.json',{headers,signal:AbortSignal.timeout(12000)});
  if(!meta.ok)throw Error('SEC ticker index HTTP '+meta.status);
  const symbols=Object.values(await meta.json());
  const now=new Date(),today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  for(let offset=0;offset<7;offset++){
   const d=new Date(today-offset*86400000);
   const day=d.toISOString().slice(0,10);
   if(d.getUTCDay()===0||d.getUTCDay()===6)continue;
   const quarter=Math.floor(d.getUTCMonth()/3)+1;
   const url='https://www.sec.gov/Archives/edgar/daily-index/'+d.getUTCFullYear()+'/QTR'+quarter+'/master.'+day.replaceAll('-','')+'.idx';
   try{
    const r=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});
    if(r.status===404)continue;
    if(!r.ok){diagnostics.push({date:day,status:r.status,matched:0,bytes:0,valid:false});errors.push(day+': SEC HTTP '+r.status);continue}
    const raw=await r.text();
    const diag={date:day,status:r.status,contentType:r.headers.get('content-type')||'unknown',bytes:raw.length,matched:0,valid:false};
    diagnostics.push(diag);
    try{
     const parsed=parseMasterIndex(raw,day,symbols);
     diag.valid=true;diag.matched=parsed.length;successfulDays++;
     found.push(...parsed);
    }catch(e){errors.push(day+': '+(e instanceof Error?e.message:'Invalid SEC index format'))}
   }catch(e){errors.push(day+': '+(e instanceof Error?e.message:'Feed failed'))}
  }
  let fallbackChecked=0,fallbackFailed=0;
  if(found.length===0){
   const matches=new Map(symbols.filter(x=>x?.ticker&&Number.isSafeInteger(Number(x.cik_str))).map(x=>[x.ticker.toUpperCase(),x]));
   for(const ticker of FALLBACK){
    const item=matches.get(ticker);if(!item)continue;
    await new Promise(resolve=>setTimeout(resolve,260)); // well below SEC's 10 requests/sec guideline
    try{
     const cik=String(item.cik_str).padStart(10,'0');
     const r=await fetch('https://data.sec.gov/submissions/CIK'+cik+'.json',{headers,signal:AbortSignal.timeout(10000)});
     fallbackChecked++;
     if(!r.ok){fallbackFailed++;fallbackDiagnostics.push({ticker,error:'SEC HTTP '+r.status});continue}
     const data=await r.json();
     const leads=recentSubmissions(data,ticker);
     found.push(...leads);
     fallbackDiagnostics.push(summarizeSubmissions(data,ticker));
    }catch(e){fallbackFailed++;fallbackDiagnostics.push({ticker,error:e instanceof Error?e.message:'Request failed'})}
   }
  }
  if(!successfulDays&&fallbackChecked===0)throw Error('No SEC sources could be retrieved: '+errors.join('; '));
  const source=fallbackChecked?'Limited company-submissions fallback':'SEC daily master index';
  const body={
   coverageStatus:fallbackChecked?'Limited fallback — market-wide indexes yielded no valid matching leads':errors.length?'Partial market-wide index coverage':'Available daily indexes retrieved',
   source,retrievedAt:new Date().toISOString(),lookbackCalendarDays:7,successfulDays,errorDays:errors,matchedFilings:found.length,
   rows:rankFreshFilings(found),fallbackChecked,fallbackFailed,diagnostics,fallbackDiagnostics,
   note:'SEC index failures and delayed submissions can cause missing leads. No filing type alone proves a bullish opportunity.'
  };
  cache={at:Date.now(),body};send(res,200,body);
 }catch(e){send(res,502,{error:e instanceof Error?e.message:'SEC-wide discovery unavailable',errorDays:errors,diagnostics})}
 return true;
}
