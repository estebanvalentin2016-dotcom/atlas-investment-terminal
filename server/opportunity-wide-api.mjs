// SEC daily master indexes are market-wide filing discovery, not sentiment or financial evaluation.
import {gunzipSync} from 'node:zlib';
import {fetchSec,fetchSecJson,publicSecError,requireSecIdentity} from './sec-request-client.mjs';

// Inspect raw bytes: some SEC endpoints serve octet-stream text, and transport
// layers may leave raw gzip bytes. Never classify undecodable files as empty.
export function decodeIndexBytes(bytes){
 const input=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 const gz=input[0]===0x1f&&input[1]===0x8b;
 const unpacked=gz?gunzipSync(input):input;
 const utf16=unpacked[0]===0xff&&unpacked[1]===0xfe;
 return {text:new TextDecoder(utf16?'utf-16le':'utf-8').decode(unpacked),encoding:gz?'gzip':utf16?'utf-16le':'utf-8'};
}
// Both the discovery parser and its diagnostics consume the SAME decoded
// records; extra validation must not silently discard valid 8-K ticker matches.
function indexRecords(text){
 const records=[];
 for(const line of text.split(/\r?\n/)){
  const fields=line.split('|').map(x=>x.trim());
  if(fields.length!==5||!/^\d{1,10}$/.test(fields[0]))continue;
  const [cik,name,form,filed,path]=fields;
  records.push({cik,name,form,filed,path});
 }
 return records;
}
const archivePath=path=>/^edgar\/data\/\d+\/[\w./-]+\.txt$/.test(path)&&!path.includes('..');
export function normalizeSecDate(raw){
 if(typeof raw!=='string')return null;
 const date=/^\d{8}$/.test(raw)?raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8):raw;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const parsed=new Date(date+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;
}

const tickerIndex=tickers=>new Map(tickers.filter(x=>typeof x?.ticker==='string'&&Number.isSafeInteger(Number(x.cik_str))).map(x=>[String(Number(x.cik_str)),x]));
export function parseMasterIndex(text,indexDate,tickers){
 if(typeof text!=='string'||!Array.isArray(tickers))throw Error('Invalid index response');
 const records=indexRecords(text);
 const header=/CIK\s*\|.*Company.*\|.*Form.*\|.*Date.*\|.*File/i.test(text.slice(0,4096));
 if(!records.length&&!header)throw Error('Unrecognized SEC master index content');
 const tickerMap=tickerIndex(tickers),rows=[];
 for(const x of records){
  if(!['8-K','8-K/A'].includes(x.form)||!archivePath(x.path))continue;
  const ticker=tickerMap.get(String(Number(x.cik)));
  if(!ticker)continue;
  const filingDate=normalizeSecDate(x.filed);
  // Never suppress discovery because the raw legal filing-date field is unexpected.
  // Unknown filing dates stay unknown; the public index's date remains separately labeled.
  rows.push({ticker:ticker.ticker,name:ticker.title||x.name,form:x.form,filed:filingDate,discoveredOn:indexDate,url:'https://www.sec.gov/Archives/'+x.path,cik:x.cik,kind:'8-K (contents unreviewed)'});
 }
 return rows;
}
export function diagnoseMasterIndex(text,tickers){
 const records=indexRecords(text),tickerMap=tickerIndex(tickers),samples=[];
 let eightKRows=0,validEightKPaths=0,tickerMatchedEightK=0,undatedEightK=0;
 for(const x of records){
  if(!['8-K','8-K/A'].includes(x.form))continue;
  eightKRows++;
  if(archivePath(x.path))validEightKPaths++;
  const match=tickerMap.get(String(Number(x.cik)));
  if(match)tickerMatchedEightK++;
  if(!normalizeSecDate(x.filed))undatedEightK++;
  if(samples.length<2)samples.push({cik:x.cik,form:x.form,filedRaw:x.filed.slice(0,30),path:x.path.slice(0,110),mappedTicker:match?.ticker||null});
 }
 return {records:records.length,eightKRows,validEightKPaths,tickerMatchedEightK,undatedEightK,samples};
}
export function rankFreshFilings(rows,limit=40){
 const unique=new Map();
 for(const r of rows){
  if(!r?.url||!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(r.url))continue;
  unique.set(r.url,r);
 }
 return [...unique.values()].sort((a,b)=>(b.discoveredOn||b.filed).localeCompare(a.discoveredOn||a.filed)||(b.filed||'').localeCompare(a.filed||'')||a.ticker.localeCompare(b.ticker)).slice(0,limit);
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
 try{requireSecIdentity()}catch(e){send(res,503,publicSecError(e,'SEC_USER_AGENT not configured'));return true}
 if(cache&&Date.now()-cache.at<10*60000){send(res,200,cache.body);return true}
 const errors=[],found=[],diagnostics=[],fallbackDiagnostics=[];let successfulDays=0;
 try{
  const headers={Accept:'text/plain,application/json'};
  const meta=await fetchSecJson('https://www.sec.gov/files/company_tickers.json',{cacheTtlMs:30*60*1000,timeoutMs:12000});
  const symbols=Object.values(meta.data);
  const now=new Date(),today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  for(let offset=0;offset<7;offset++){
   const d=new Date(today-offset*86400000);
   const day=d.toISOString().slice(0,10);
   if(d.getUTCDay()===0||d.getUTCDay()===6)continue;
   const quarter=Math.floor(d.getUTCMonth()/3)+1;
   const url='https://www.sec.gov/Archives/edgar/daily-index/'+d.getUTCFullYear()+'/QTR'+quarter+'/master.'+day.replaceAll('-','')+'.idx';
   try{
    const r=await fetchSec(url,{accept:headers.Accept,timeoutMs:12000,allowedStatuses:[404]});
    if(r.status===404)continue;
    const wire=new Uint8Array(await r.arrayBuffer());
    let raw='',encoding='unreadable';
    try{const decoded=decodeIndexBytes(wire);raw=decoded.text;encoding=decoded.encoding}
    catch(e){errors.push(day+': index decoding failed: '+(e instanceof Error?e.message:'unknown error'))}
    const diag={date:day,status:r.status,contentType:r.headers.get('content-type')||'unknown',bytes:wire.byteLength,encoding,firstChars:raw.slice(0,160).replace(/[\x00-\x1f\x7f]/g,' '),audit:diagnoseMasterIndex(raw,symbols),matched:0,valid:false};
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
    try{
     const cik=String(item.cik_str).padStart(10,'0');
     const r=await fetchSecJson('https://data.sec.gov/submissions/CIK'+cik+'.json',{accept:headers.Accept,cacheTtlMs:10*60*1000,timeoutMs:10000});
     fallbackChecked++;
     const data=r.data;
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
   rows:rankFreshFilings(found,1200),returnedFilings:Math.min(1200,new Set(found.map(x=>x.url)).size),truncated:new Set(found.map(x=>x.url)).size>1200,fallbackChecked,fallbackFailed,diagnostics,fallbackDiagnostics,
   note:'SEC index failures and delayed submissions can cause missing leads. No filing type alone proves a bullish opportunity.'
  };
  cache={at:Date.now(),body};send(res,200,body);
 }catch(e){send(res,502,{...publicSecError(e,'SEC-wide discovery unavailable'),errorDays:errors,diagnostics})}
 return true;
}
