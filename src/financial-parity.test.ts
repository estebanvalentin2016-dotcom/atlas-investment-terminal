import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {filings,rawFacts} from './financial-parity-fixtures';
import {deriveRankingMetrics,assessEmergingFcfStrength,type SecCompany} from './ranking-model';
import {initialAutonomousScreen} from './autonomous-screen';
import {buildResearchHistoryRecords,RESEARCH_HISTORY_MODEL_VERSION} from './research-history-model';
import {appendResearchHistory,readResearchHistory} from './research-history-storage';
// @ts-ignore JavaScript-only SEC route is exercised at its existing request boundary.
import {handleSecRequest} from '../server/sec-api.mjs';

const expected={
 NVDA:{growth:65.47,fcf:null,fcfMargin:null,netMargin:55.6,screen:'incomplete_financials'},
 AMD:{growth:34.34,fcf:null,fcfMargin:null,netMargin:null,screen:'incomplete_financials'},
 CRWD:{growth:21.71,fcf:1310241000,fcfMargin:27.23,netMargin:-3.35,screen:'preliminary_pass'}
} as const;
const AS_OF='2026-10-19';
const metric=(company:SecCompany,name:string)=>company.metrics.find(item=>item.name===name)!;
const companies=new Map<string,SecCompany>();
async function request(ticker:string):Promise<SecCompany>{
 let status=0,body='';
 await handleSecRequest({url:'/api/sec/company?ticker='+ticker,method:'GET'},{writeHead(code:number){status=code},end(value:string){body=value}});
 expect(status).toBe(200);
 return JSON.parse(body) as SecCompany;
}
function memoryStorage():Storage{
 const values=new Map<string,string>();
 return {get length(){return values.size},clear(){values.clear()},getItem:key=>values.get(key)??null,key:index=>[...values.keys()][index]??null,removeItem:key=>{values.delete(key)},setItem:(key,value)=>{values.set(key,value)}};
}

beforeAll(async()=>{
 const started=performance.now(),fixed=Date.parse(AS_OF+'T12:00:00.000Z');
 vi.spyOn(Date,'now').mockImplementation(()=>fixed+Math.floor(performance.now()-started));
 vi.stubEnv('SEC_USER_AGENT','ATLAS parity tests sec-tests@example.com');
 vi.stubGlobal('fetch',vi.fn(async(input:string|URL|Request)=>{
  const url=String(input);
  if(url.endsWith('/company_tickers.json'))return new Response(JSON.stringify(Object.fromEntries(filings.map((row,index)=>[index,{ticker:row.ticker,title:row.name,cik_str:row.cik}]))),{status:200});
  const row=filings.find(item=>url.endsWith('/CIK'+String(item.cik).padStart(10,'0')+'.json'));
  if(!row)return new Response('not found',{status:404});
  if(url.includes('/companyfacts/'))return new Response(JSON.stringify(rawFacts(row)),{status:200});
  if(url.includes('/submissions/'))return new Response(JSON.stringify({sic:row.ticker==='CRWD'?'7372':'3674',sicDescription:row.ticker==='CRWD'?'Services-Prepackaged Software':'Semiconductors & Related Devices'}),{status:200});
  return new Response('not found',{status:404});
 }));
 for(const row of filings)companies.set(row.ticker,await request(row.ticker));
});
afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs()});

describe('filing-backed production financial parity boundary',()=>{
 it('preserves source observations, fiscal selection, approved calculations, and screen verdicts',()=>{
  for(const row of filings){
   const company=companies.get(row.ticker)!;
   const asOf=AS_OF;
   const revenue=metric(company,'Revenue');
   const operating=metric(company,'Operating cash flow');
   const capex=metric(company,'Capital expenditures');
   const income=metric(company,'Net income');
   expect(company).toMatchObject({ticker:row.ticker,cik:String(row.cik).padStart(10,'0'),source:`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(row.cik).padStart(10,'0')}.json`});
   expect(company.classification?.retrievedAt.slice(0,10)).toBe(AS_OF);
   expect(revenue).toMatchObject({tag:row.revenueTag,unit:'USD',reportingScope:'entity_wide'});
   expect(revenue.values[0]).toMatchObject({year:row.year,start:row.start,end:row.end,filed:row.filed,accession:row.accession,unit:'USD',form:'10-K',value:row.revenue,reviewIssues:[]});
   expect(revenue.values[1]).toMatchObject({start:row.priorStart,end:row.priorEnd,accession:row.accession,value:row.priorRevenue});
   expect(operating.values[0]).toMatchObject({start:row.start,end:row.end,filed:row.filed,accession:row.accession,unit:'USD',tag:'NetCashProvidedByUsedInOperatingActivities',value:row.operating});
   expect(income.values[0]).toMatchObject({start:row.start,end:row.end,filed:row.filed,accession:row.accession,unit:'USD'});
   const result=deriveRankingMetrics(company,null,asOf);
   const screen=initialAutonomousScreen(company,asOf);
   expect(result).toMatchObject({year:row.year,revenue:row.revenue,growth:expected[row.ticker].growth,fcf:expected[row.ticker].fcf,fcfMargin:expected[row.ticker].fcfMargin,profitMargin:expected[row.ticker].netMargin,pe:null});
   expect(screen.status).toBe(expected[row.ticker].screen);
   expect(screen).toMatchObject({growth:result.growth,fcfMargin:result.fcfMargin,netMargin:result.profitMargin,filed:row.filed});
   expect(assessEmergingFcfStrength(company,asOf).status).toBe('insufficient_evidence');
   if(row.ticker==='NVDA'){
    expect(capex.values.some(value=>value.end===row.end)).toBe(false);
    expect(capex.excludedBroaderFact).toMatchObject({tag:'PaymentsToAcquireProductiveAssets',value:row.productiveAssets,accession:row.accession});
    expect(screen.missingEvidence).toContainEqual(expect.objectContaining({metric:'Capital expenditures'}));
   }else{
    expect(capex.values[0]).toMatchObject({start:row.start,end:row.end,filed:row.filed,accession:row.accession,unit:'USD',tag:'PaymentsToAcquirePropertyPlantAndEquipment',value:row.capex});
   }
   if(row.ticker==='AMD'){
    expect(operating.values[0].reviewIssues).toContain('discontinued_operations_scope');
    expect(income.values[0].reviewIssues).toContain('discontinued_operations_scope');
    expect(screen.missingEvidence).toContainEqual(expect.objectContaining({cause:'accounting_reconciliation_required'}));
   }
   if(row.ticker==='CRWD'){
    expect(income).toMatchObject({tag:'ProfitLoss',reportingScope:'consolidated'});
    expect(income.values[0].value).toBe(row.consolidatedNet);
    expect(company.metrics.some(item=>item.name==='Capital expenditures'&&item.tag==='PaymentsToDevelopSoftware')).toBe(false);
   }
  }
 });

 it('stores scan-time interpretations with accession and methodology provenance, without inventing price data',()=>{
  const storage=memoryStorage();
  for(const row of filings){
   const company=companies.get(row.ticker)!;
   const asOf=AS_OF;
   const screen=initialAutonomousScreen(company,asOf);
   const emerging=assessEmergingFcfStrength(company,asOf);
   const completedAt=asOf+'T23:59:59.000Z';
   const [record]=buildResearchHistoryRecords({completed:true,completedAt,assessmentDate:asOf,runId:'parity-'+row.ticker,assessments:[{company,screen,emerging}]});
   expect(record).toMatchObject({assessmentModelVersion:RESEARCH_HISTORY_MODEL_VERSION,assessedAt:completedAt,ticker:row.ticker,screen:{verdict:screen.status,annualFiled:row.filed},metrics:{fiscalYear:row.year,revenueGrowth:screen.growth,fcfMargin:screen.fcfMargin,netMargin:screen.netMargin},source:{companyFactsUrl:company.source,companyFactsRetrievedAt:company.retrievedAt,fiscalPeriodEnd:row.end,revenueAccession:row.accession},valuation:null,ranking:null});
   expect(record.limitations.join(' ')).toContain('PP&E');
   expect(appendResearchHistory(storage,[record]).status).toBe('saved');
  }
  const history=readResearchHistory(storage);
  expect(history.status).toBe('ok');
  expect(history.records.map(record=>record.ticker)).toEqual(['NVDA','AMD','CRWD']);
  expect(history.records[0].metrics.fcfMargin).toBeNull();
  expect(history.records[1].metrics.fcfMargin).toBeNull();
  expect(history.records[2].metrics.fcfMargin).toBe(27.23);
 });

 it('withholds post-assessment observations and a new unreviewed accession from stored conclusions',()=>{
  const company=structuredClone(companies.get('CRWD')!);
  const beforeFiling='2026-03-04';
  const early=initialAutonomousScreen(company,beforeFiling);
  expect(deriveRankingMetrics(company,null,beforeFiling)).toMatchObject({year:null,revenue:null,fcf:null,fcfMargin:null,profitMargin:null});
  expect(early.status).toBe('stale_financials');
  const [earlyRecord]=buildResearchHistoryRecords({completed:true,completedAt:'2026-03-05T01:00:00.000Z',assessmentDate:beforeFiling,runId:'before-filing',assessments:[{company,screen:early,emerging:assessEmergingFcfStrength(company,beforeFiling)}]});
  expect(earlyRecord).toMatchObject({metrics:{fiscalYear:null,revenueGrowth:null,fcfMargin:null,netMargin:null},source:{fiscalPeriodEnd:null,revenueAccession:null}});
  const capex=metric(company,'Capital expenditures');
  capex.values[0].accession='0001535527-26-000011';
  const asOf=AS_OF;
  const mixed=initialAutonomousScreen(company,asOf);
  expect(deriveRankingMetrics(company,null,asOf)).toMatchObject({fcf:null,fcfMargin:null});
  expect(mixed.status).toBe('incomplete_financials');
  expect(mixed.missingEvidence).toContainEqual(expect.objectContaining({metric:'Capital expenditures',cause:'accounting_reconciliation_required'}));
  const [mixedRecord]=buildResearchHistoryRecords({completed:true,completedAt:asOf+'T23:59:59.000Z',assessmentDate:asOf,runId:'unreviewed-accession',assessments:[{company,screen:mixed,emerging:assessEmergingFcfStrength(company,asOf)}]});
  expect(mixedRecord.metrics.fcfMargin).toBeNull();
  expect(mixedRecord.screen.verdict).toBe('incomplete_financials');
 });
});
