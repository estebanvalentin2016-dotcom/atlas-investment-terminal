import {afterEach,describe,expect,it,vi} from 'vitest';
import {coverageCauseCounts,diagnoseFinancialCoverage,initialAutonomousScreen} from './autonomous-screen';
import {deriveRankingMetrics,type SecCompany} from './ranking-model';
import {reportedFinancialEvidence} from './reported-financial-evidence';
import {ReportedFundamentals} from './RealWorkspace';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
// @ts-ignore JavaScript-only SEC backend module is tested directly.
import {handleSecRequest} from '../server/sec-api.mjs';

const filings=[
 {ticker:'NVDA',cik:1045810,name:'NVIDIA CORP',year:2026,start:'2025-01-27',end:'2026-01-25',priorEnd:'2025-01-26',filed:'2026-02-25',accession:'0001045810-26-000021',revenueTag:'Revenues',revenue:215938000000,priorRevenue:130497000000,operating:102718000000,net:120067000000,capex:null,productiveAssets:6042000000},
 {ticker:'AMD',cik:2488,name:'ADVANCED MICRO DEVICES INC',year:2025,start:'2024-12-29',end:'2025-12-27',priorEnd:'2024-12-28',filed:'2026-02-04',accession:'0000002488-26-000018',revenueTag:'RevenueFromContractWithCustomerExcludingAssessedTax',revenue:34639000000,priorRevenue:25785000000,operating:7709000000,net:4335000000,capex:974000000,productiveAssets:null},
 {ticker:'CRWD',cik:1535527,name:'CrowdStrike Holdings, Inc.',year:2026,start:'2025-02-01',end:'2026-01-31',priorEnd:'2025-01-31',filed:'2026-03-05',accession:'0001535527-26-000010',revenueTag:'RevenueFromContractWithCustomerIncludingAssessedTax',revenue:4812005000,priorRevenue:3953624000,operating:1612349000,net:-162502000,capex:302108000,productiveAssets:null}
] as const;

const annual=(row:typeof filings[number],value:number,end:string=row.end,start:string=row.start)=>({form:'10-K',fp:'FY',start,end,filed:row.filed as string,accn:row.accession as string,val:value});
const fact=(...values:ReturnType<typeof annual>[])=>({units:{USD:values}});
function rawFacts(row:typeof filings[number]){
 const gaap:Record<string,unknown>={
  [row.revenueTag]:fact(annual(row,row.revenue),annual(row,row.priorRevenue,row.priorEnd,'2024-01-01')),
  NetCashProvidedByUsedInOperatingActivities:fact(annual(row,row.operating)),
  NetIncomeLoss:fact(annual(row,row.net))
 };
 if(row.capex!==null)gaap.PaymentsToAcquirePropertyPlantAndEquipment=fact(annual(row,row.capex));
 else{
  gaap.PaymentsToAcquirePropertyPlantAndEquipment=fact({form:'10-K',fp:'FY',start:'2011-01-31',end:'2012-01-29',filed:'2012-03-13',accn:'0001045810-12-000007',val:138735000});
  gaap.PaymentsToAcquireProductiveAssets=fact(annual(row,row.productiveAssets!));
 }
 return {entityName:row.name,facts:{'us-gaap':gaap}};
}
async function request(url:string){
 let status=0,body='';
 await handleSecRequest({url,method:'GET'},{writeHead(code:number){status=code},end(value:string){body=value}});
 return {status,data:JSON.parse(body)};
}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});

describe('SEC-backed financial coverage fixtures',()=>{
 it('retains each selected tag, fiscal period, accession, amount, and source without widening capex',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS contact sec-tests@example.com');
  vi.stubGlobal('fetch',vi.fn(async(input:string|URL|Request)=>{
   const url=String(input);
   if(url.endsWith('/company_tickers.json'))return new Response(JSON.stringify({...Object.fromEntries(filings.map((row,index)=>[index,{ticker:row.ticker,title:row.name,cik_str:row.cik}])),3:{ticker:'FAIL',title:'Unavailable Source Fixture',cik_str:9999999}}),{status:200});
   const row=filings.find(item=>url.endsWith('/CIK'+String(item.cik).padStart(10,'0')+'.json'));
   if(!row)return new Response('not found',{status:404});
   if(url.includes('/companyfacts/'))return new Response(JSON.stringify(rawFacts(row)),{status:200});
   if(url.includes('/submissions/'))return new Response(JSON.stringify({sic:row.ticker==='CRWD'?'7372':'3674',sicDescription:row.ticker==='CRWD'?'Services-Prepackaged Software':'Semiconductors & Related Devices'}),{status:200});
   return new Response('not found',{status:404});
  }));
  for(const row of filings){
    const response=await request('/api/sec/company?ticker='+row.ticker);
    expect(response.status).toBe(200);
    const company=response.data as SecCompany;
    expect(company.source).toBe('https://data.sec.gov/api/xbrl/companyfacts/CIK'+String(row.cik).padStart(10,'0')+'.json');
    expect(company.factTaxonomies).toEqual({usGaap:true,ifrsFull:false});
    const revenue=company.metrics.find(metric=>metric.name==='Revenue')!;
    expect(revenue).toMatchObject({tag:row.revenueTag,sourceFactPresent:true});
    expect(revenue.values[0]).toMatchObject({value:row.revenue,end:row.end,filed:row.filed,accession:row.accession});
    const capex=company.metrics.find(metric=>metric.name==='Capital expenditures')!;
    expect(capex.sourceFactPresent).toBe(true);
    expect(capex.values.some(value=>value.end===row.end)).toBe(row.capex!==null);
    if(row.capex!==null)expect(capex.values[0]).toMatchObject({value:row.capex,end:row.end,accession:row.accession,tag:'PaymentsToAcquirePropertyPlantAndEquipment'});
    const metrics=deriveRankingMetrics(company);
    expect(metrics.capex).toBe(row.capex);
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));
    const screen=initialAutonomousScreen(company,'2026-10-19');
    vi.useRealTimers();
    expect(screen.status).toBe(row.ticker==='NVDA'?'incomplete_financials':'preliminary_pass');
    if(row.ticker==='NVDA'){
     expect(metrics.fcf).toBeNull();
     expect(capex.excludedBroaderFact).toMatchObject({tag:'PaymentsToAcquireProductiveAssets',value:6042000000,end:'2026-01-25',filed:'2026-02-25',accession:'0001045810-26-000021'});
     expect(screen.missingEvidence).toContainEqual(expect.objectContaining({metric:'Capital expenditures',cause:'incompatible_fiscal_periods'}));
     expect(screen.reasons.join(' ')).toContain('not substituted for PP&E capex');
     const reported=reportedFinancialEvidence(company);
     expect(reported).toMatchObject({revenue:{value:215938000000},netIncome:{value:120067000000},operating:{value:102718000000},productiveAssets:{value:6042000000,accession:row.accession},cashAfterProductiveAssets:96676000000});
     const html=renderToStaticMarkup(createElement(ReportedFundamentals,{company}));
     expect(html).toContain('Reported net income');
     expect(html).toContain('$120.07B');
     expect(html).toContain('$102.72B');
     expect(html).toContain('$6.04B');
     expect(html).toContain('$96.68B');
     expect(html).toContain('not substituted into the existing FCF screen');
     expect(html).toContain(row.accession);
     expect(html).not.toContain('Unavailable');
     expect(html).not.toContain('Needs filing review');
    }else expect(metrics.fcf).toBe(row.operating-row.capex!);
  }
  const failed=await request('/api/sec/company?ticker=FAIL');
  expect(failed).toMatchObject({status:503,data:{errorCategory:'upstream_http_error'}});
  expect(coverageCauseCounts([],1).sourceRetrievalFailure).toBe(1);
 });
});

const fy=(year:number,value:number,end=year+'-12-31')=>({year,end,filed:(year+1)+'-02-15',value,form:'10-K',accession:'0000000000-26-000100'});
function company():SecCompany{return {ticker:'CASE',name:'Coverage Fixture',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json',retrievedAt:'2026-10-19T12:00:00.000Z',factTaxonomies:{usGaap:true,ifrsFull:false},metrics:[
 {name:'Revenue',tag:'Revenues',sourceFactPresent:true,values:[fy(2025,150),fy(2024,100)]},
 {name:'Operating cash flow',sourceFactPresent:true,values:[fy(2025,32)]},
 {name:'Capital expenditures',sourceFactPresent:true,values:[fy(2025,6)]},
 {name:'Net income',sourceFactPresent:true,values:[fy(2025,12)]}
]};}

describe('specific missing-data diagnostics without changing screening rules',()=>{
 it('distinguishes unsupported IFRS-only data from a missing supported US-GAAP revenue tag',()=>{
  const ifrs=company();ifrs.factTaxonomies={usGaap:false,ifrsFull:true};ifrs.metrics[0].values=[];ifrs.metrics[0].sourceFactPresent=false;
  expect(diagnoseFinancialCoverage(ifrs)).toContainEqual(expect.objectContaining({metric:'Revenue',cause:'unsupported_taxonomy'}));
  const absent=company();absent.metrics[0].values=[];absent.metrics[0].sourceFactPresent=false;
  expect(diagnoseFinancialCoverage(absent)).toContainEqual(expect.objectContaining({metric:'Revenue',cause:'absent_source_fact'}));
  expect(initialAutonomousScreen(ifrs,'2026-10-19').status).toBe('stale_financials');
  expect(initialAutonomousScreen(absent,'2026-10-19').status).toBe('stale_financials');
 });
 it('distinguishes missing prior revenue, absent cash-flow tag and incompatible annual periods',()=>{
  const missingPrior=company();missingPrior.metrics[0].values=[fy(2025,150)];
  expect(diagnoseFinancialCoverage(missingPrior)).toContainEqual(expect.objectContaining({cause:'missing_comparable_prior_year'}));
  const absentOperating=company();absentOperating.metrics[1].values=[];absentOperating.metrics[1].sourceFactPresent=false;
  expect(diagnoseFinancialCoverage(absentOperating)).toContainEqual(expect.objectContaining({metric:'Operating cash flow',cause:'absent_source_fact'}));
  const misaligned=company();misaligned.metrics[2].values=[fy(2025,6,'2025-09-30')];
  expect(diagnoseFinancialCoverage(misaligned)).toContainEqual(expect.objectContaining({metric:'Capital expenditures',cause:'incompatible_fiscal_periods'}));
  expect(initialAutonomousScreen(misaligned,'2026-10-19').status).toBe('incomplete_financials');
 });
 it('retains observable criterion failures alongside an incomplete verdict',()=>{
  const weak=company();weak.metrics[0].values=[fy(2025,87),fy(2024,322)];weak.metrics[2].values=[];weak.metrics[2].sourceFactPresent=false;weak.metrics[3].values=[fy(2025,-219)];
  const result=initialAutonomousScreen(weak,'2026-10-19');
  expect(result.status).toBe('incomplete_financials');
  expect(result.observedCriterionFailures).toEqual(expect.arrayContaining(['Annual revenue growth below provisional +10% floor','Net margin below provisional −10% threshold']));
  expect(result.reasons.join(' ')).toContain('Observed criterion failure despite incomplete evidence');
  expect(result.score).toBeNull();
  expect(coverageCauseCounts([result],1)).toMatchObject({absentSourceFact:1,sourceRetrievalFailure:1,incompleteWithObservedFailures:1});
 });
 it('treats reported zero capex and zero net income as evidence, not missing data',()=>{
  const zero=company();zero.metrics[2].values=[fy(2025,0)];zero.metrics[3].values=[fy(2025,0)];
  expect(diagnoseFinancialCoverage(zero)).toEqual([]);
  expect(deriveRankingMetrics(zero)).toMatchObject({capex:0,profitMargin:0});
  expect(reportedFinancialEvidence(zero).netIncome?.value).toBe(0);
 });
 it('does not combine broader spending with a different fiscal period or accession',()=>{
  const mismatch=company();
  mismatch.metrics[2].values=[];
  mismatch.metrics[2].excludedBroaderFact={...fy(2025,6),'tag':'PaymentsToAcquireProductiveAssets',accession:'0000000000-26-000200'};
  expect(reportedFinancialEvidence(mismatch).cashAfterProductiveAssets).toBeNull();
  mismatch.metrics[2].excludedBroaderFact={...fy(2025,6,'2025-09-30'),'tag':'PaymentsToAcquireProductiveAssets'};
  expect(reportedFinancialEvidence(mismatch).cashAfterProductiveAssets).toBeNull();
  expect(deriveRankingMetrics(mismatch).fcf).toBeNull();
 });
});
