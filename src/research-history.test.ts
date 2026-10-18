import {describe,expect,it,vi} from 'vitest';
import {initialAutonomousScreen} from './autonomous-screen';
import {assessEmergingFcfStrength,defaultRankWeights,scoreCompany,type SecCompany} from './ranking-model';
import {buildResearchHistoryRecords,RESEARCH_HISTORY_MODEL_VERSION,type ResearchHistoryAssessmentInput,type ResearchHistoryRecordV1} from './research-history-model';
import {appendResearchHistory,MAX_RESEARCH_HISTORY_RECORDS,readResearchHistory,RESEARCH_HISTORY_KEY} from './research-history-storage';

function memoryStorage(initial?:string):Storage{
 const values=new Map<string,string>();
 if(initial!==undefined)values.set(RESEARCH_HISTORY_KEY,initial);
 return {get length(){return values.size},clear(){values.clear()},getItem:key=>values.get(key)??null,key:index=>[...values.keys()][index]??null,removeItem:key=>{values.delete(key)},setItem:(key,value)=>{values.set(key,value)}};
}
const annual=(year:number,value:number)=>({year,end:`${year}-12-31`,filed:`${year+1}-02-15`,form:'10-K',accession:`0000000001-${String(year+1).slice(-2)}-000001`,value});
const company=(ticker='HIST'):SecCompany=>({
 ticker,name:ticker+' Industries',cik:'0000000001',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json',retrievedAt:'2026-10-18T15:30:00.000Z',
 metrics:[
  {name:'Revenue',values:[annual(2025,150),annual(2024,100),annual(2023,90)]},
  {name:'Operating cash flow',values:[annual(2025,35),annual(2024,20),annual(2023,10)]},
  {name:'Capital expenditures',values:[annual(2025,5),annual(2024,5),annual(2023,5)]},
  {name:'Net income',values:[annual(2025,20)]}
 ]
});
const assessed=(ticker='HIST'):ResearchHistoryAssessmentInput=>{
 const issuer=company(ticker);
 return {company:issuer,screen:initialAutonomousScreen(issuer,'2026-10-18'),emerging:assessEmergingFcfStrength(issuer)};
};
const build=(runId='run-1',ticker='HIST')=>buildResearchHistoryRecords({completed:true,completedAt:'2026-10-18T16:00:00.000Z',runId,assessments:[assessed(ticker)]});

describe('durable browser-local research assessment history',()=>{
 it('appends completed runs and preserves multiple assessments for the same ticker',()=>{
  const storage=memoryStorage();
  expect(appendResearchHistory(storage,build('run-1')).status).toBe('saved');
  expect(appendResearchHistory(storage,build('run-2')).status).toBe('saved');
  const result=readResearchHistory(storage);
  expect(result.status).toBe('ok');
  expect(result.records).toHaveLength(2);
  expect(result.records.map(record=>record.runId)).toEqual(['run-1','run-2']);
  expect(result.records.every(record=>record.ticker==='HIST')).toBe(true);
  expect(new Set(result.records.map(record=>record.recordId)).size).toBe(2);
 });

 it('preserves null missing evidence rather than manufacturing zeroes',()=>{
  const input=assessed('MISS');
  input.company.cik=undefined;
  input.company.metrics.find(metric=>metric.name==='Capital expenditures')!.values=[];
  input.screen=initialAutonomousScreen(input.company,'2026-10-18');
  input.emerging=assessEmergingFcfStrength(input.company);
  const [record]=buildResearchHistoryRecords({completed:true,completedAt:'2026-10-18T16:00:00.000Z',runId:'missing-run',assessments:[input]});
  expect(record.cik).toBeNull();
  expect(record.metrics.fcfMargin).toBeNull();
  expect(record.screen.preliminaryScore).toBeNull();
  expect(record.valuation).toBeNull();
  expect(record.ranking).toBeNull();
  expect(record.limitations).toContain('Valuation and long-term price enrichment were not performed for this issuer in the bounded completed scan.');
  expect(record.historicalProof).toBe('browser_local_not_tamper_proof');
 });

 it('creates records only for a completed scan and retains explicit model/source identity',()=>{
  const assessment=assessed();
  expect(buildResearchHistoryRecords({completed:false,completedAt:'2026-10-18T16:00:00.000Z',runId:'failed-run',assessments:[assessment]})).toEqual([]);
  const records=buildResearchHistoryRecords({completed:true,completedAt:'2026-10-18T16:00:00.000Z',runId:'complete-run',assessments:[assessment]});
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({assessmentModelVersion:RESEARCH_HISTORY_MODEL_VERSION,completionStatus:'completed_scan',cik:'0000000001'});
  expect(records[0].source).toMatchObject({companyFactsUrl:assessment.company.source,companyFactsRetrievedAt:assessment.company.retrievedAt,fiscalPeriodEnd:'2025-12-31'});
 });

 it('attaches valuation and ranking only to the issuer with matching enrichment',()=>{
  const first=assessed('VALUE'),second=assessed('PLAIN');
  const quote={ticker:'VALUE',price:40,sessionDate:'2026-10-17',feed:'IEX',provider:'Alpaca',completedSession:true};
  const valuation={pe:20,eps:2,epsEnd:'2025-12-31',priceDate:'2026-10-17',reason:'Indicative fiscal-year P/E'};
  const ranking=scoreCompany(first.company,defaultRankWeights,20);
  const records=buildResearchHistoryRecords({completed:true,completedAt:'2026-10-18T16:00:00.000Z',runId:'enriched-run',assessments:[first,second],enrichments:[{ticker:'VALUE',valuation,quote,ranking,priceIssue:null,historyIssue:null}]});
  expect(records[0].valuation).toMatchObject({annualPe:20,eps:2,price:40,priceDate:'2026-10-17',provider:'Alpaca',feed:'IEX'});
  expect(records[0].ranking).toMatchObject({score:ranking.score,coverage:ranking.coverage});
  expect(records[1].valuation).toBeNull();
  expect(records[1].ranking).toBeNull();
 });

 it('refuses to overwrite malformed history and distinguishes unavailable storage',()=>{
  const malformed=memoryStorage('{not-json');
  const setItem=vi.spyOn(malformed,'setItem');
  expect(readResearchHistory(malformed).status).toBe('malformed');
  expect(appendResearchHistory(malformed,build())).toMatchObject({status:'malformed',saved:0});
  expect(setItem).not.toHaveBeenCalled();
  const unavailable={getItem(){throw Error('Storage blocked')},setItem(){throw Error('Storage blocked')}};
  expect(readResearchHistory(unavailable).status).toBe('unavailable');
  expect(appendResearchHistory(unavailable,build())).toMatchObject({status:'unavailable',saved:0});
 });

 it('reports quota/write failures without claiming records were saved',()=>{
  const quota={getItem(){return null},setItem(){throw new DOMException('Quota exceeded','QuotaExceededError')}};
  expect(appendResearchHistory(quota,build())).toEqual({status:'write_failed',saved:0,retained:0,dropped:0});
 });

 it('retains the newest 1,200 records without deduplicating tickers and reports eviction',()=>{
  const storage=memoryStorage();
  const template=build()[0];
  const original:Array<ResearchHistoryRecordV1>=Array.from({length:MAX_RESEARCH_HISTORY_RECORDS},(_,index)=>({...template,recordId:'old-'+index,runId:'old-run-'+index}));
  expect(appendResearchHistory(storage,original)).toMatchObject({status:'saved',saved:MAX_RESEARCH_HISTORY_RECORDS,dropped:0});
  const next=[{...template,recordId:'new-1',runId:'new-run-1'},{...template,recordId:'new-2',runId:'new-run-2'}];
  expect(appendResearchHistory(storage,next)).toEqual({status:'saved',saved:2,retained:MAX_RESEARCH_HISTORY_RECORDS,dropped:2});
  const records=readResearchHistory(storage).records;
  expect(records).toHaveLength(MAX_RESEARCH_HISTORY_RECORDS);
  expect(records.at(-2)?.recordId).toBe('new-1');
  expect(records.at(-1)?.recordId).toBe('new-2');
  expect(records.filter(record=>record.ticker==='HIST')).toHaveLength(MAX_RESEARCH_HISTORY_RECORDS);
 });
});
