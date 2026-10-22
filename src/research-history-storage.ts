import {RESEARCH_HISTORY_MODEL_VERSION,PREVIOUS_RESEARCH_HISTORY_MODEL_VERSION,type ResearchHistoryRecordV1} from './research-history-model';

export const RESEARCH_HISTORY_KEY='atlas.research.assessment-history.v1';
// Retain the newest 1,200 individual issuer assessments across all completed
// runs. Same-ticker records are never deduplicated. When the cap is exceeded,
// oldest records are evicted and the append result reports the exact count.
export const MAX_RESEARCH_HISTORY_RECORDS=1200;
export type ResearchHistoryReadResult={records:ResearchHistoryRecordV1[];status:'ok'|'unavailable'|'malformed'};
export type ResearchHistoryAppendResult={status:'saved'|'unavailable'|'malformed'|'write_failed';saved:number;retained:number;dropped:number};
type StorageReaderWriter=Pick<Storage,'getItem'|'setItem'>;

const utc=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value));
const day=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const dayOrNull=(value:unknown)=>value===null||day(value);
const finiteOrNull=(value:unknown)=>value===null||(typeof value==='number'&&Number.isFinite(value));
const strings=(value:unknown)=>Array.isArray(value)&&value.every(item=>typeof item==='string');
const secUrl=(value:unknown)=>{try{const url=new URL(String(value));return url.protocol==='https:'&&url.hostname==='data.sec.gov'&&url.pathname.startsWith('/api/xbrl/companyfacts/')}catch{return false}};
const classificationValid=(value:unknown)=>{
 if(value===null)return true;
 if(!value||typeof value!=='object')return false;
 const x=value as {status?:unknown;system?:unknown;code?:unknown;description?:unknown;source?:unknown;retrievedAt?:unknown;reason?:unknown};
 let sourceOk=false;try{const url=new URL(String(x.source));sourceOk=url.protocol==='https:'&&url.hostname==='data.sec.gov'&&url.pathname.startsWith('/submissions/')}catch{}
 if(x.system!=='SEC SIC'||!sourceOk||!utc(x.retrievedAt))return false;
 if(x.status==='reported')return typeof x.code==='string'&&/^\d{4}$/.test(x.code)&&typeof x.description==='string'&&Boolean(x.description.trim());
 return x.status==='unavailable'&&x.code===null&&x.description===null&&typeof x.reason==='string';
};
function validRecord(value:unknown):value is ResearchHistoryRecordV1{
 if(!value||typeof value!=='object')return false;
 const x=value as ResearchHistoryRecordV1;
 if(x.version!==1||![RESEARCH_HISTORY_MODEL_VERSION,PREVIOUS_RESEARCH_HISTORY_MODEL_VERSION].includes(x.assessmentModelVersion as typeof RESEARCH_HISTORY_MODEL_VERSION)||x.completionStatus!=='completed_scan'||x.historicalProof!=='browser_local_not_tamper_proof')return false;
 if(typeof x.recordId!=='string'||!x.recordId||typeof x.runId!=='string'||!x.runId||!utc(x.assessedAt)||!/^[A-Z0-9.-]{1,12}$/.test(x.ticker)||typeof x.companyName!=='string'||!x.companyName)return false;
 if(x.cik!==null&&(typeof x.cik!=='string'||!/^\d{10}$/.test(x.cik)))return false;
 if(!x.screen||!['preliminary_pass','incomplete_financials','failed_thresholds','stale_financials','accounting_review'].includes(x.screen.verdict)||!strings(x.screen.reasons)||!dayOrNull(x.screen.annualFiled)||!finiteOrNull(x.screen.preliminaryScore)||(x.screen.preliminaryScore!==null&&(x.screen.preliminaryScore<0||x.screen.preliminaryScore>100)))return false;
 if(!x.metrics||(x.metrics.fiscalYear!==null&&(!Number.isInteger(x.metrics.fiscalYear)||x.metrics.fiscalYear<1900))||!finiteOrNull(x.metrics.revenueGrowth)||!finiteOrNull(x.metrics.fcfMargin)||!finiteOrNull(x.metrics.netMargin))return false;
 if(!x.emergingStrength||!['improving','not_improving','insufficient_evidence'].includes(x.emergingStrength.status)||!Array.isArray(x.emergingStrength.years)||!x.emergingStrength.years.every(Number.isInteger)||!Array.isArray(x.emergingStrength.margins)||!x.emergingStrength.margins.every(finiteOrNull))return false;
 if(!x.source||!secUrl(x.source.companyFactsUrl)||!utc(x.source.companyFactsRetrievedAt)||!dayOrNull(x.source.fiscalPeriodEnd)||(x.source.revenueAccession!==null&&typeof x.source.revenueAccession!=='string')||!classificationValid(x.source.classification))return false;
 if(x.valuation!==null&&(!Number.isFinite(x.valuation.annualPe)||x.valuation.annualPe<=0||!Number.isFinite(x.valuation.eps)||x.valuation.eps<=0||!Number.isFinite(x.valuation.price)||x.valuation.price<=0||!day(x.valuation.epsPeriodEnd)||!day(x.valuation.priceDate)||typeof x.valuation.provider!=='string'||!x.valuation.provider||typeof x.valuation.feed!=='string'||!x.valuation.feed))return false;
 if(x.ranking!==null&&(!finiteOrNull(x.ranking.score)||(x.ranking.score!==null&&(x.ranking.score<0||x.ranking.score>100))||!Number.isFinite(x.ranking.coverage)||x.ranking.coverage<0||x.ranking.coverage>100||!Number.isInteger(x.ranking.factorCount)||x.ranking.factorCount<0||!strings(x.ranking.reasons)||!strings(x.ranking.missing)))return false;
 return strings(x.limitations);
}

export function readResearchHistory(storage:Pick<Storage,'getItem'>):ResearchHistoryReadResult{
 let raw:string|null;
 try{raw=storage.getItem(RESEARCH_HISTORY_KEY)}catch{return {records:[],status:'unavailable'}}
 if(raw===null)return {records:[],status:'ok'};
 try{
  const parsed:unknown=JSON.parse(raw);
  if(!Array.isArray(parsed)||!parsed.every(validRecord))return {records:[],status:'malformed'};
  return {records:parsed,status:'ok'};
 }catch{return {records:[],status:'malformed'}}
}

export function appendResearchHistory(storage:StorageReaderWriter,records:ResearchHistoryRecordV1[]):ResearchHistoryAppendResult{
 const current=readResearchHistory(storage);
 if(current.status!=='ok')return {status:current.status,saved:0,retained:current.records.length,dropped:0};
 if(!records.length)return {status:'saved',saved:0,retained:current.records.length,dropped:0};
 if(!records.every(validRecord))return {status:'malformed',saved:0,retained:current.records.length,dropped:0};
 const combined=[...current.records,...records];
 const retained=combined.slice(-MAX_RESEARCH_HISTORY_RECORDS);
 const dropped=combined.length-retained.length;
 try{
  storage.setItem(RESEARCH_HISTORY_KEY,JSON.stringify(retained));
  return {status:'saved',saved:records.length,retained:retained.length,dropped};
 }catch{return {status:'write_failed',saved:0,retained:current.records.length,dropped:0}}
}

export function appendBrowserResearchHistory(records:ResearchHistoryRecordV1[]):ResearchHistoryAppendResult{
 try{return appendResearchHistory(globalThis.localStorage,records)}
 catch{return {status:'unavailable',saved:0,retained:0,dropped:0}}
}
