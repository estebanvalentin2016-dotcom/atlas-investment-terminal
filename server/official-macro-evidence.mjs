// Experimental, server-only macro evidence. Not connected to production research.
const SOURCES = Object.freeze({
 cpi:{agency:'U.S. Bureau of Labor Statistics',url:'https://www.bls.gov/news.release/cpi.nr0.htm',host:'www.bls.gov',path:/^\/news\.release\/cpi\.nr0\.htm$/},
 employment:{agency:'U.S. Bureau of Labor Statistics',url:'https://www.bls.gov/news.release/empsit.nr0.htm',host:'www.bls.gov',path:/^\/news\.release\/empsit\.nr0\.htm$/},
 fomc:{agency:'Board of Governors of the Federal Reserve System',url:null,host:'www.federalreserve.gov',path:/^\/newsevents\/pressreleases\/monetary\d{8}a\.htm$/}
});
const UNAVAILABLE='unavailable';
const iso = value => typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const validMonth = value => typeof value==='string' && /^\d{4}-\d\d$/.test(value) && Number(value.slice(5))>=1 && Number(value.slice(5))<=12;
const officialUrl=(type,value)=>{try{const u=new URL(value);const s=SOURCES[type];return u.protocol==='https:'&&u.hostname===s.host&&s.path.test(u.pathname)&&!u.search&&!u.hash?u.href:null}catch{return null}};
const normalizeObservation=(type,row)=>{
 const units={cpi:{cpi_monthly_change:'percent',cpi_annual_change:'percent'},employment:{nonfarm_payroll_change:'persons',unemployment_rate:'percent'},fomc:{federal_funds_target_lower:'percent',federal_funds_target_upper:'percent'}};
 return row&&Object.hasOwn(units[type],row.key)&&row.unit===units[type][row.key]&&typeof row.value==='number'&&Number.isFinite(row.value)
  ? {key:row.key,value:row.value,unit:row.unit,sourceCaption:typeof row.sourceCaption==='string'?row.sourceCaption:null,status:'reported'} : null;
};

export function normalizeOfficialMacroEvidence(input){
 const type=input?.eventType, source=SOURCES[type];
 if(!source) return {status:UNAVAILABLE,reason:'unsupported_event_type'};
 const url=officialUrl(type,input.sourceUrl);
 if(!url)return {status:UNAVAILABLE,reason:'unverified_official_source'};
 const publishedAt=iso(input.publishedAt),retrievedAt=iso(input.retrievedAt);
 if(!publishedAt)return {status:UNAVAILABLE,reason:'publication_time_unverified'};
 if(!retrievedAt)return {status:UNAVAILABLE,reason:'retrieval_time_unverified'};
 if(Date.parse(publishedAt)>Date.parse(retrievedAt))return {status:UNAVAILABLE,reason:'future_publication'};
 const referencePeriod=type==='fomc'
  ? (/^\d{4}-\d\d-\d\d$/.test(input.referencePeriod??'')?input.referencePeriod:null)
  : (validMonth(input.referencePeriod)?input.referencePeriod:null);
 if(!referencePeriod)return {status:UNAVAILABLE,reason:'reference_period_unverified'};
 const observations=[];
 for(const row of input.observations??[]){const normalized=normalizeObservation(type,row);if(!normalized)return {status:UNAVAILABLE,reason:'invalid_observation_or_unit'};if(observations.some(item=>item.key===normalized.key))return {status:UNAVAILABLE,reason:'duplicate_observation'};observations.push(normalized)}
 const revision=input.revision?.status==='revised'&&iso(input.revision.publishedAt)
  ? {status:'revised',publishedAt:iso(input.revision.publishedAt),note:input.revision.note??null}
  : {status:'unknown',publishedAt:null,note:null};
 if(revision.publishedAt&&Date.parse(revision.publishedAt)>Date.parse(retrievedAt))return {status:UNAVAILABLE,reason:'future_revision'};
 const id=`macro-v1:${type}:${referencePeriod}:${url}`;
 return {schemaVersion:1,id,eventType:type,status:'official_observation',source:{agency:source.agency,url,publishedAt,publishedTimeZone:input.publishedTimeZone??'unknown',publicationTimeBasis:type==='fomc'?'official_for_release_at':'official_embargo_until',retrievedAt},referencePeriod,observations,observationStatus:observations.length?'reported':'unknown',revision,
  possibleTransmissionMechanism:null,companySpecificEvidence:null,analystInterpretation:null,uncertainty:['Release-page extraction is bounded; other observations or later corrections may exist. No company-specific effect has been assessed.']};
}

export function appendMacroEvidence(existing,record){
 const list=Array.isArray(existing)?existing:[];
 if(record?.status!=='official_observation')return list;
 // Re-fetching unchanged content is not a new event. Changed source observations
 // remain a separate retrieval vintage, even when correction metadata is unknown.
 const sameEvidence=item=>item?.id===record.id&&JSON.stringify(item.observations)===JSON.stringify(record.observations)&&JSON.stringify(item.revision)===JSON.stringify(record.revision);
 return list.some(sameEvidence)?list:[...list,record];
}

export function macroEvidenceAsOf(records,assessmentAt){
 const at=iso(assessmentAt);if(!at)return [];
 return (Array.isArray(records)?records:[]).filter(row=>row?.status==='official_observation'&&row.source&&
  [row.source.publishedAt,row.source.retrievedAt,row.revision?.publishedAt].every(value=>!value||iso(value)&&Date.parse(value)<=Date.parse(at)));
}

const monthNumber=name=>{const n=['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(name.toLowerCase());return n<0?null:String(n+1).padStart(2,'0')};
const plain=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const easternOffset=(year,month,day)=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).formatToParts(new Date(Date.UTC(year,month-1,day,17)));return parts.find(x=>x.type==='timeZoneName')?.value==='GMT-4'?4:5};
const releaseClock=(text,type,url)=>{
 if(type==='fomc'){
  const d=url.match(/monetary(\d{4})(\d\d)(\d\d)a\.htm$/),t=text.match(/For release at\s+(\d{1,2}):(\d\d)\s*([ap])\.m\.\s*(EST|EDT)/i);
  if(!d||!t)return null;
  const pageDate=new Date(Date.UTC(Number(d[1]),Number(d[2])-1,Number(d[3]))).toLocaleDateString('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'});
  if(!text.includes(pageDate))return null;
  const hour=Number(t[1])%12+(t[3].toLowerCase()==='p'?12:0),offset=t[4].toUpperCase()==='EDT'?4:5;
  return {publishedAt:new Date(Date.UTC(Number(d[1]),Number(d[2])-1,Number(d[3]),hour+offset,Number(t[2]))).toISOString(),timezone:t[4].toUpperCase(),period:`${d[1]}-${d[2]}-${d[3]}`};
 }
 const stamp=text.match(/8:30\s*a\.m\.\s*\(ET\)\s*\w+,\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})/i);
 const heading=text.match(type==='cpi'?/CONSUMER PRICE INDEX\s*-\s*(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})/i:/THE EMPLOYMENT SITUATION\s*-\s*(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})/i);
 if(!stamp||!heading)return null;
 const month=Number(monthNumber(stamp[1])),day=Number(stamp[2]),year=Number(stamp[3]);
 return {publishedAt:new Date(Date.UTC(year,month-1,day,8+easternOffset(year,month,day),30)).toISOString(),timezone:'America/New_York',period:`${heading[2]}-${monthNumber(heading[1])}`};
};
const observationsFromText=(type,text)=>{
 const rows=[];
 if(type==='cpi'){
  const m=text.match(/CPI-U\)\s+(increased|decreased)\s+(\d+(?:\.\d+)?)\s*percent on a seasonally adjusted basis/i);
  if(m)rows.push({key:'cpi_monthly_change',value:Number(m[2])*(m[1]==='decreased'?-1:1),unit:'percent',sourceCaption:m[0]});
  const y=text.match(/Over the last 12 months, the all items index (increased|decreased)\s+(\d+(?:\.\d+)?) percent before seasonal adjustment/i);
  if(y)rows.push({key:'cpi_annual_change',value:Number(y[2])*(y[1]==='decreased'?-1:1),unit:'percent',sourceCaption:y[0]});
 }else if(type==='employment'){
  const m=text.match(/nonfarm payroll employment\s*\(([+−-]?[\d,]+)\)\s+and the unemployment rate\s*\((\d+(?:\.\d+)?) percent\)/i);
  if(m){rows.push({key:'nonfarm_payroll_change',value:Number(m[1].replace(/[,+−]/g,x=>x==='−'?'-':'')),unit:'persons',sourceCaption:m[0]});rows.push({key:'unemployment_rate',value:Number(m[2]),unit:'percent',sourceCaption:m[0]})}
 }else if(type==='fomc'){
  const m=text.match(/target range for the federal funds rate at\s+(\d+(?:[‑–-]\d+\/\d+|\.\d+)?)\s+to\s+(\d+(?:[‑–-]\d+\/\d+|\.\d+)?)\s+percent/i);
  const number=value=>{const fraction=value.match(/^(\d+)[‑–-](\d+)\/(\d+)$/);return fraction?Number(fraction[1])+Number(fraction[2])/Number(fraction[3]):Number(value)};
  if(m){rows.push({key:'federal_funds_target_lower',value:number(m[1]),unit:'percent',sourceCaption:m[0]});rows.push({key:'federal_funds_target_upper',value:number(m[2]),unit:'percent',sourceCaption:m[0]})}
 }
 return rows;
};

// Bounded current-release fetch. A later page revision is never backdated to the original release.
export async function ingestOfficialMacroRelease({eventType,sourceUrl=SOURCES[eventType]?.url,fetchImpl=fetch,now=()=>new Date()}={}){
 if(!SOURCES[eventType])return {status:UNAVAILABLE,reason:'unsupported_event_type'};
 const url=officialUrl(eventType,sourceUrl);if(!url)return {status:UNAVAILABLE,reason:'unverified_official_source'};
 try{
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(8000),headers:{Accept:'text/html'}});
  if(!response.ok)return {status:UNAVAILABLE,reason:'source_http_error',httpStatus:response.status};
  const html=await response.text();if(html.length>750000)return {status:UNAVAILABLE,reason:'source_too_large'};
  const content=plain(html),clock=releaseClock(content,eventType,url);
  if(!clock)return {status:UNAVAILABLE,reason:'publication_or_period_unverified'};
  const retrievedAt=now().toISOString();
  return normalizeOfficialMacroEvidence({eventType,sourceUrl:url,publishedAt:clock.publishedAt,publishedTimeZone:clock.timezone,referencePeriod:clock.period,retrievedAt,observations:observationsFromText(eventType,content)});
 }catch{return {status:UNAVAILABLE,reason:'source_retrieval_failed'}}
}
