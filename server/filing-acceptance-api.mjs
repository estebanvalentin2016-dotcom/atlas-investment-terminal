// SEC accepted time from the raw EDGAR SGML header, never the ambiguous
// submissions JSON acceptanceDateTime timestamp. This is NOT issuer release time.
import {permittedFilingUrl,parseArchiveFiling,readBoundedFiling} from './filing-review-api.mjs';
const reply=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))};
export function extractSecAcceptanceHeader(raw,accession){
 if(typeof raw!=='string'||raw.length<20)return null;
 const headStart=raw.indexOf('<SEC-HEADER>');
 if(headStart<0||headStart>4096)return null;
 const headEnd=raw.indexOf('</SEC-HEADER>',headStart);
 if(headEnd<0||headEnd>120000)return null; // only trust the actual top-level header
 const head=raw.slice(headStart,headEnd);
 const accessionMatch=head.match(/(?:^|\n)\s*ACCESSION NUMBER:\s*(\d{10}-\d{2}-\d{6})\b/i);
 if(!accessionMatch||accessionMatch[1]!==accession)return null;
 const stamp=head.match(/<ACCEPTANCE-DATETIME>\s*(\d{14})\b/i);
 if(!stamp)return null;
 const digits=stamp[1];
 const date=digits.slice(0,4)+'-'+digits.slice(4,6)+'-'+digits.slice(6,8);
 const h=Number(digits.slice(8,10)),m=Number(digits.slice(10,12)),s=Number(digits.slice(12,14));
 const d=new Date(date+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date||h>23||m>59||s>59)return null;
 const time=digits.slice(8,10)+':'+digits.slice(10,12)+':'+digits.slice(12,14);
 const minute=h*60+m;
 return {acceptedEasternDate:date,acceptedEasternTime:time,acceptedEasternClock:date+' '+time+' ET',sessionWindow:minute<570?'before_regular_open':minute<960?'during_regular_session':'after_regular_close',provenance:'EDGAR SGML ACCEPTANCE-DATETIME (Eastern local clock)',firstPublicReleaseVerified:false};
}
const cache=new Map();
export async function handleFilingAcceptanceRequest(req,res){
 const route=new URL(req.url,'http://localhost');
 if(route.pathname!=='/api/opportunities/acceptance')return false;
 if(req.method!=='GET'){reply(res,405,{error:'Method not allowed'});return true}
 const url=permittedFilingUrl(route.searchParams.get('url'));
 const filing=url&&parseArchiveFiling(url);
 if(!filing){reply(res,400,{error:'Invalid SEC accession source URL'});return true}
 const agent=process.env.SEC_USER_AGENT;
 if(!agent||!agent.includes('@')){reply(res,503,{error:'SEC_USER_AGENT not configured'});return true}
 const cached=cache.get(url);
 if(cached&&Date.now()-cached.at<15*60000){reply(res,200,cached.result);return true}
 let response;
 try{
  response=await fetch(url,{headers:{'User-Agent':agent,Accept:'text/plain'},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('SEC HTTP '+response.status);
  const read=await readBoundedFiling(response,96000);
  const accepted=extractSecAcceptanceHeader(read.text,filing.accession);
  const result={sourceUrl:url,sourceStatus:accepted?'verified_header':'unavailable',accepted,bytesRead:read.bytesRead,headerWindowTruncated:read.truncated,retrievedAt:new Date().toISOString(),note:accepted?'Raw EDGAR header acceptance clock in Eastern Time, not verified issuer first-publication time.':'No trustworthy accession-matched raw EDGAR acceptance time found in the inspected header.'};
  if(cache.size>40)cache.clear();
  cache.set(url,{at:Date.now(),result});
  reply(res,200,result);
 }catch(e){reply(res,200,{sourceUrl:url,sourceStatus:'unavailable',accepted:null,note:e instanceof Error?e.message:'Raw filing time unavailable',retrievedAt:new Date().toISOString()})}
 return true;
}
