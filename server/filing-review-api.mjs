// Inspect public 8-K source text for research-review phrases, NOT trading signals.
// The SEC filing itself is the evidence source; phrases may be negated, historical,
// boilerplate, or financially immaterial. Never infer remaining upside.
const respond=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
const patterns=[
 {label:'Raised outlook / guidance',kind:'potential',re:/\b(?:rais(?:es|ed|ing)|increas(?:es|ed|ing)|lift(?:s|ed|ing)|boost(?:s|ed|ing))\s+(?:its\s+|the\s+|our\s+)?(?:full[- ]year\s+|annual\s+|revenue\s+|earnings\s+)?(?:guidance|outlook|forecast)\b/gi},
 {label:'Contract award language',kind:'potential',re:/\b(?:awarded|secured|won)\s+(?:a\s+|an\s+|the\s+)?(?:new\s+|major\s+|multi[- ]year\s+|government\s+)?(?:contract|award|agreement)\b/gi},
 {label:'Regulatory approval language',kind:'potential',re:/\b(?:fda|food and drug administration)\s+(?:has\s+)?(?:approved|granted approval|cleared)\b|\b(?:received|receives)\s+(?:fda\s+)?(?:regulatory\s+)?approval\b/gi},
 {label:'Record revenue language',kind:'potential',re:/\b(?:record\s+(?:quarterly\s+|annual\s+|full[- ]year\s+)?revenue|revenue\s+(?:grew|increased)\s+(?:by\s+)?\d+(?:\.\d+)?%)/gi},
 {label:'Downward guidance language',kind:'caution',re:/\b(?:lower(?:s|ed|ing)|reduc(?:es|ed|ing)|cut(?:s|ting)?)\s+(?:its\s+|the\s+|our\s+)?(?:full[- ]year\s+|annual\s+|revenue\s+|earnings\s+)?(?:guidance|outlook|forecast)\b/gi},
 {label:'Financing / dilution language',kind:'caution',re:/\b(?:going concern|substantial doubt|material weakness|dilutive financing|at[- ]the[- ]market offering)\b/gi}
];
export function permittedFilingUrl(input){
 if(typeof input!=='string'||input.length>300)return null;
 try{
  const u=new URL(input);
  if(u.protocol!=='https:'||u.hostname!=='www.sec.gov'||u.username||u.password||u.port||u.search||u.hash)return null;
  if(!/^\/Archives\/edgar\/data\/\d+\/(?:\d+\/)?[A-Za-z0-9._-]+\.txt$/.test(u.pathname)||u.pathname.includes('..'))return null;
  return u.href;
 }catch{return null}
}
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
export function extractFilingText(raw){
 if(typeof raw!=='string'||!raw)return '';
 // Full EDGAR submissions may include exhibits. Keep main 8-K body first;
 // append a bounded sample of the surrounding submission for exhibit language.
 const matches=[...raw.matchAll(/<DOCUMENT>([\s\S]*?)<\/DOCUMENT>/gi)];
 const primary=matches.find(m=>/<TYPE>\s*8-K(?:\/A)?\b/i.test(m[1]));
 const body=primary?primary[1]+'\n'+raw.slice(0,1000000):raw;
 return body.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi,(_,e)=>{
   const lower=e.toLowerCase();if(lower.startsWith('#')){const radix=lower.startsWith('#x')?16:10;const code=parseInt(lower.slice(radix===16?2:1),radix);return Number.isInteger(code)&&code>=32&&code<=0x10ffff?String.fromCodePoint(code):' '}
   return entities[lower]||' ';
  }).replace(/\s+/g,' ').trim().slice(0,1400000);
}
export function assessFilingEvidence(sourceText){
 const text=extractFilingText(sourceText),potential=[],cautions=[];
 for(const entry of patterns){
  const match=entry.re.exec(text);entry.re.lastIndex=0;
  if(!match)continue;
  const evidence={label:entry.label,excerpt:text.slice(Math.max(0,match.index-100),Math.min(text.length,match.index+match[0].length+180)).trim()};
  if(entry.kind==='potential')potential.push(evidence);else cautions.push(evidence);
 }
 return {status:potential.length&&cautions.length?'mixed_claims':potential.length?'potential_language':'no_positive_phrase_detected',potential:potential.slice(0,4),cautions:cautions.slice(0,3),textCharacters:text.length,limitations:'Rule-based text matching only. Phrases are not verified for context, novelty, size, timing, or sign; no bullish conclusion, valuation, upside estimate or trade recommendation.'};
}
// SEC full-submission files can contain large exhibits. Inspect a strictly
// bounded prefix instead of rejecting an otherwise reachable filing by size.
export async function readBoundedFiling(response,maxBytes=4000000){
 const declared=Number(response.headers.get('content-length'));
 const declaredBytes=Number.isSafeInteger(declared)&&declared>=0?declared:null;
 if(!response.body)throw Error('SEC filing body unavailable');
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let bytesRead=0,text='',complete=false,truncated=false;
 try{
  while(bytesRead<maxBytes){
   const next=await reader.read();
   if(next.done){complete=true;break}
   const room=maxBytes-bytesRead;
   const part=next.value.byteLength>room?next.value.subarray(0,room):next.value;
   text+=decoder.decode(part,{stream:true});
   bytesRead+=part.byteLength;
   if(part.byteLength<next.value.byteLength){truncated=true;break}
  }
  if(!complete&&!truncated){
   const extra=await reader.read();
   complete=extra.done;
   truncated=!extra.done;
  }
  return {text:text+decoder.decode(),bytesRead,truncated:truncated||(declaredBytes!==null&&declaredBytes>maxBytes),declaredBytes,limitBytes:maxBytes};
 }finally{
  if(!complete){try{await reader.cancel()}catch{}}
  reader.releaseLock();
 }
}
const cache=new Map();
export async function handleFilingReview(req,res){
 const route=new URL(req.url,'http://localhost');
 if(route.pathname!=='/api/opportunities/review')return false;
 if(req.method!=='GET'){respond(res,405,{error:'Method not allowed'});return true}
 const url=permittedFilingUrl(route.searchParams.get('url'));
 if(!url){respond(res,400,{error:'Enter a valid SEC 8-K source URL'});return true}
 const agent=process.env.SEC_USER_AGENT;
 if(!agent||!agent.includes('@')){respond(res,503,{error:'SEC_USER_AGENT is not configured'});return true}
 const prior=cache.get(url);
 if(prior&&Date.now()-prior.at<15*60000){respond(res,200,prior.data);return true}
 try{
  const response=await fetch(url,{headers:{'User-Agent':agent,Accept:'text/plain,text/html'},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok){
   const data={url,sourceStatus:'unavailable',httpStatus:response.status,evidence:null,retrievedAt:new Date().toISOString(),note:'SEC source could not be retrieved. No classification is possible.'};
   respond(res,200,data);return true;
  }
  const read=await readBoundedFiling(response);
  const source=read.text;
  if(!/<SEC-DOCUMENT\b|<DOCUMENT>|\bFORM\s+8[- ]K\b/i.test(source)){
   respond(res,200,{url,sourceStatus:'unavailable',evidence:null,retrievedAt:new Date().toISOString(),note:'SEC response did not contain recognizable 8-K filing structure; evidence review skipped.'});
   return true;
  }
  const evidence=assessFilingEvidence(source);
  const data={url,sourceStatus:read.truncated?'partial_text':'reviewed_text',httpStatus:200,evidence,bytesRead:read.bytesRead,declaredBytes:read.declaredBytes,limitBytes:read.limitBytes,truncated:read.truncated,retrievedAt:new Date().toISOString(),note:read.truncated?'Partial review only: read the first '+read.bytesRead.toLocaleString('en-US')+' bytes of a larger SEC submission. Material later exhibits may be missing. An absent pattern is inconclusive.':'Phrase matches in SEC submission text are not verified event classifications. Inspect the original filing.'};
  if(cache.size>30)cache.clear();
  cache.set(url,{at:Date.now(),data});
  respond(res,200,data);
 }catch(e){respond(res,200,{url,sourceStatus:'unavailable',evidence:null,retrievedAt:new Date().toISOString(),note:e instanceof Error?e.message:'SEC filing could not be reviewed'})}
 return true;
}
