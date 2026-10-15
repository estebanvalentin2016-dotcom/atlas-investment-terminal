// Institutional 13F research: quarterly reported holdings, NOT trades or investor motives.
// Reuses the SEC_USER_AGENT and bounded archive reader from the existing SEC pipeline.
import {readBoundedFiling} from './filing-review-api.mjs';

export const RESEARCH_MANAGERS=[
 {cik:'1743937',name:'TOMS Capital Investment Management LP',category:'Classification unverified',role:'Identity documented in SEC 13F accession 0000902664-26-003522'},
 {cik:'1418814',name:'ValueAct Holdings, L.P.',category:'Classification unverified',role:'Identity documented in SEC 13F accession 0001418814-26-000003'}
];
const root='https://www.sec.gov';
const memory=new Map();
const respond=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
const cleanText=t=>String(t||'').replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|apos);/g,' ').trim().replace(/\s+/g,' ').slice(0,190);
const tag=(xml,key)=>{const match=xml.match(new RegExp('<(?:[A-Za-z_][\\w.-]*:)?'+key+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?'+key+'\\s*>','i'));return match?cleanText(match[1]):''};
const safeInt=s=>/^\d+(?:\.\d+)?$/.test(s)&&Number.isFinite(Number(s))&&Number(s)>=0?Number(s):null;
const safeName=s=>typeof s==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.xml$/i.test(s)&&!s.includes('..');
const safeCik=s=>/^\d{1,10}$/.test(s||'')&&Number(s)>0;
const isDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const archive=(cik,acc)=>root+'/Archives/edgar/data/'+Number(cik)+'/'+acc.replaceAll('-','')+'/';
export function select13FReports(submission){
 const data=submission?.filings?.recent;
 if(!Array.isArray(data?.accessionNumber))return {reports:[],issue:'No recent 13F reports available; older archived submission pages are not yet inspected'};
 const perPeriod=new Map();
 for(let i=0;i<data.accessionNumber.length;i++){
  const form=data.form?.[i],accession=data.accessionNumber[i],period=data.reportDate?.[i],filed=data.filingDate?.[i];
  if(!['13F-HR','13F-HR/A','13F-NT','13F-NT/A'].includes(form)||!/^\d{10}-\d{2}-\d{6}$/.test(accession)||!isDate(period)||!isDate(filed))continue;
  const group=perPeriod.get(period)||[];
  group.push({form,accession,period,filed});
  perPeriod.set(period,group);
 }
 const dates=[...perPeriod.keys()].sort().reverse();
 const reports=[];
 for(const period of dates){
  const forms=perPeriod.get(period);
  if(forms.some(r=>r.form==='13F-HR/A'||r.form==='13F-NT/A'))return {reports:[],issue:'A 13F amendment exists for '+period+'. Its scope must be reviewed before holdings changes can be trusted.'};
  if(forms.some(r=>r.form==='13F-NT'))return {reports:[],issue:'13F notice (13F-NT) for '+period+': holdings may be reported by another manager. No complete portfolio can be assumed.'};
  const holding=forms.filter(r=>r.form==='13F-HR').sort((a,b)=>b.filed.localeCompare(a.filed));
  if(holding.length!==1)return {reports:[],issue:'Ambiguous 13F-HR filings for '+period+'; comparison withheld'};
  reports.push(holding[0]);
  if(reports.length===2)break;
 }
 if(reports.length<2)return {reports,issue:'Two distinct quarter-end 13F-HR reports are required for change analysis'};
 return {reports,issue:null};
}
export function parse13FInformationTable(xml){
 if(typeof xml!=='string'||xml.length<30||!/<(?:\w+:)?informationTable\b/i.test(xml))throw Error('SEC XML information table not recognized');
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('XML entity declarations are not supported');
 const matches=[...xml.matchAll(/<(?:\w+:)?infoTable(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?infoTable\s*>/gi)];
 if(!matches.length)throw Error('No valid 13F position entries in information table');
 if(matches.length>120000)throw Error('13F information table exceeds safe row cap');
 const holdings=new Map();let excluded=0;
 for(const match of matches){
  const row=match[1],issuer=tag(row,'nameOfIssuer'),cusip=tag(row,'cusip').toUpperCase(),className=tag(row,'titleOfClass'),type=tag(row,'sshPrnamtType').toUpperCase();
  const option=tag(row,'putCall').toUpperCase(),shares=safeInt(tag(row,'sshPrnamt')),value=safeInt(tag(row,'value'));
  if(!issuer||!/^[0-9A-Z]{9}$/.test(cusip)||!className||shares===null||value===null||type!=='SH'||option){excluded++;continue}
  const key=cusip+'|'+className.toUpperCase().replace(/\s+/g,' ');
  const existing=holdings.get(key);
  if(existing){existing.shares+=shares;existing.valueDollars+=value;existing.rowCount++}
  else holdings.set(key,{key,cusip,issuer,className,shares,valueDollars:value,rowCount:1});
 }
 if(!holdings.size)throw Error('13F table has no ordinary share positions eligible for comparison');
 return {holdings:[...holdings.values()],rows:matches.length,excluded,aggregationNote:'Grouped by exact CUSIP and reported share class, not by ticker. Options and principal amounts excluded; shared managers may overlap.'};
}
export function parse13FCoverage(xml){
 if(typeof xml!=='string'||!/\x3cedgarSubmission\b/i.test(xml))throw Error('13F cover XML unavailable');
 const reportType=tag(xml,'reportType');
 const affiliates=[];
 const re=/<(?:[A-Za-z_][\w.-]*:)?otherManager(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?otherManager\s*>/gi;
 for(const item of xml.matchAll(re)){
  const cik=tag(item[1],'cik'),name=tag(item[1],'name');
  if(/^\d{1,10}$/.test(cik))affiliates.push({cik:String(Number(cik)),name});
 }
 return {reportType:reportType||'Unspecified 13F report type',otherIncludedManagers:[...new Map(affiliates.map(x=>[x.cik,x])).values()],reportCompleteness:reportType==='13F COMBINATION REPORT'?'COMBINATION: another manager reports additional securities; do not claim the table contains the entire firm's positions.':reportType==='13F HOLDINGS REPORT'?'HOLDINGS: report-level holdings only; private or unreported securities excluded.':'Cover type could not confirm the complete manager portfolio.'};
}
export async function retrieve13FCoverage(report,cik,headers){
 const base=archive(cik,report.accession),url=base+'primary_doc.xml';
 const xml=await secGet(url,headers,320000);
 return {...parse13FCoverage(xml),sourceUrl:url};
}
export function compare13FHoldings(latest,previous){
 const prior=new Map(previous.map(x=>[x.key,x])),current=new Set();
 const results=[];
 const total=latest.reduce((n,x)=>n+x.valueDollars,0);
 for(const now of latest){
  const old=prior.get(now.key);
  current.add(now.key);
  const delta=old?now.shares-old.shares:null;
  const action=!old?'newly_reported':delta>0?'reported_increase':delta<0?'reported_decrease':'unchanged';
  results.push({...now,previousShares:old?.shares??null,changeShares:delta,change:action,portfolioPct:total>0?Math.round(now.valueDollars/total*10000)/100:null});
 }
 for(const old of previous){
  if(!current.has(old.key))results.push({...old,previousShares:old.shares,shares:0,valueDollars:0,changeShares:-old.shares,change:'no_longer_reported',portfolioPct:0});
 }
 const order={newly_reported:0,reported_increase:1,reported_decrease:2,no_longer_reported:3,unchanged:4};
 results.sort((a,b)=>order[a.change]-order[b.change]||b.valueDollars-a.valueDollars||a.issuer.localeCompare(b.issuer));
 return results;
}
async function secGet(url,headers,maxBytes){
 const response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(16000)});
 if(!response.ok)throw Error('SEC HTTP '+response.status+' at '+new URL(url).pathname);
 const read=await readBoundedFiling(response,maxBytes);
 if(read.truncated)throw Error('SEC document exceeds '+maxBytes.toLocaleString('en-US')+' bytes. Holdings incomplete; comparison withheld.');
 return read.text;
}
export async function retrieve13FInformationTable(report,cik,headers){
 const base=archive(cik,report.accession),indexUrl=base+'index.json';
 const index=JSON.parse(await secGet(indexUrl,headers,1200000));
 const items=Array.isArray(index?.directory?.item)?index.directory.item:[];
 // Do not assume primary_doc.xml is the holdings table. Prefer a named
 // information-table XML, but validate the content itself before using.
 const candidates=items.filter(x=>safeName(x.name)).map(x=>x.name)
  .sort((a,b)=>(/info.?table/i.test(b)?1:0)-(/info.?table/i.test(a)?1:0)||a.localeCompare(b))
  .slice(0,10);
 if(!candidates.length)throw Error('No SEC XML files listed for this 13F accession');
 const failures=[];
 for(const name of candidates){
  if(/^primary(?:_doc)?\.xml$/i.test(name))continue;
  try{
   const directUrl=base+encodeURIComponent(name);
   const raw=await secGet(directUrl,headers,8000000);
   const parsed=parse13FInformationTable(raw);
   return {...parsed,tableUrl:directUrl,indexUrl};
  }catch(e){failures.push(name+': '+(e instanceof Error?e.message:'unavailable'))}
 }
 throw Error('No complete 13F XML information table could be verified: '+failures.slice(0,3).join('; '));
}
export async function load13FManager(cik,opts={}){
 if(!safeCik(cik))throw Error('Manager CIK must contain 1–10 digits');
 const agent=process.env.SEC_USER_AGENT;
 if(!agent||!agent.includes('@'))throw Error('SEC_USER_AGENT not configured');
 const normalized=String(Number(cik)),cached=memory.get(normalized);
 if(!opts.refresh&&cached&&Date.now()-cached.at<15*60000)return cached.value;
 const headers={'User-Agent':agent,'Accept':'application/json,application/xml,text/xml,text/plain'};
 const submissionsUrl='https://data.sec.gov/submissions/CIK'+normalized.padStart(10,'0')+'.json';
 const submission=JSON.parse(await secGet(submissionsUrl,headers,5000000));
 const choice=select13FReports(submission);
 if(choice.issue)throw Error(choice.issue);
 const [latest,previous]=choice.reports;
 const latestQuarter=Number(latest.period.slice(0,4))*4+Math.floor((Number(latest.period.slice(5,7))-1)/3);
 const priorQuarter=Number(previous.period.slice(0,4))*4+Math.floor((Number(previous.period.slice(5,7))-1)/3);
 if(latestQuarter-priorQuarter!==1)throw Error('Two consecutive reporting quarters not available. Holdings changes would span multiple quarters; comparison withheld.');
 const latestHoldings=await retrieve13FInformationTable(latest,normalized,headers);
 const previousHoldings=await retrieve13FInformationTable(previous,normalized,headers);
 const rows=compare13FHoldings(latestHoldings.holdings,previousHoldings.holdings);
 const value={cik:normalized,manager:submission.name||'SEC reporting manager',submissionUrl,latest:{...latest,sourceUrl:latestHoldings.tableUrl,positions:latestHoldings.holdings.length,rows:latestHoldings.rows,excluded:latestHoldings.excluded},previous:{...previous,sourceUrl:previousHoldings.tableUrl,positions:previousHoldings.holdings.length,rows:previousHoldings.rows,excluded:previousHoldings.excluded},rows,coverage:{subset:'Ordinary shares, exact CUSIP and class',latestExcluded:latestHoldings.excluded,previousExcluded:previousHoldings.excluded,reportCompleteness:'Two 13F-HR information tables fully read within 8 MB per XML document. Does not establish whole-firm private holdings, historical trades, or ultimate beneficial owners.'},retrievedAt:new Date().toISOString()};
 memory.set(normalized,{at:Date.now(),value});
 if(memory.size>12)memory.clear();
 return value;
}
export async function handleInstitutionalRequest(req,res){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname!=='/api/institutions/managers')return false;
 if(req.method!=='GET'){respond(res,405,{error:'Method not allowed'});return true}
 const cik=url.searchParams.get('cik')||'';
 if(!safeCik(cik)){respond(res,400,{error:'Enter a valid SEC manager CIK'});return true}
 try{respond(res,200,await load13FManager(cik))}
 catch(e){respond(res,503,{error:e instanceof Error?e.message:'SEC manager filings unavailable',cik,coverage:'No holdings comparison produced'})}
 return true;
}
