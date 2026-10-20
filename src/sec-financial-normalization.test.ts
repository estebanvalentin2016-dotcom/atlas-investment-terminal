import {describe,expect,it} from 'vitest';
// @ts-ignore Pure JavaScript SEC normalization module is tested directly.
import {attachFilingScopeEvidence,normalizeSecFinancialFacts,reconcileAnnualSecFacts} from '../server/sec-financial-normalization.mjs';

const cases={
 NVDA:{cik:1045810,name:'NVIDIA CORP',start:'2025-01-27',end:'2026-01-25',fy:2026,filed:'2026-02-25',accession:'0001045810-26-000021',filingUrl:'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm'},
 AMD:{cik:2488,name:'ADVANCED MICRO DEVICES INC',start:'2024-12-29',end:'2025-12-27',fy:2025,filed:'2026-02-04',accession:'0000002488-26-000018',filingUrl:'https://www.sec.gov/Archives/edgar/data/2488/000000248826000018/amd-20251227.htm'},
 CRWD:{cik:1535527,name:'CrowdStrike Holdings, Inc.',start:'2025-02-01',end:'2026-01-31',fy:2026,filed:'2026-03-05',accession:'0001535527-26-000010',filingUrl:'https://www.sec.gov/Archives/edgar/data/1535527/000153552726000010/crwd-20260131.htm'}
} as const;
type Filing=typeof cases[keyof typeof cases];
const observation=(row:Filing,value:number,extra:Record<string,unknown>={})=>({
 start:row.start,end:row.end,fy:row.fy,fp:'FY',form:'10-K',filed:row.filed,accn:row.accession,val:value,...extra
});
function normalize(row:Filing,amounts:Record<string,number|Array<Record<string,unknown>>>,taxonomy='us-gaap'):Array<Record<string,any>>{
 const entries=Object.fromEntries(Object.entries(amounts).map(([concept,amount])=>[concept,{units:{USD:Array.isArray(amount)?amount:[observation(row,amount)]}}]));
 return normalizeSecFinancialFacts({cik:row.cik,entityName:row.name,facts:{[taxonomy]:entries}},{
  cik:row.cik,concepts:Object.keys(amounts),taxonomy,filingUrls:{[row.accession]:row.filingUrl}
 });
}
const fact=(facts:Array<Record<string,any>>,concept:string)=>facts.find(item=>item.concept===concept)!;
const scoped=(item:Record<string,any>,operations:string,attribution='consolidated',caption='Consolidated statement of cash flows')=>
 attachFilingScopeEvidence(item,{operations,attribution,filingUrl:item.filingUrl,caption});
const request=(role:string,concept:string,kind='context')=>({role,concept,kind});
const reconcile=(row:Filing,facts:Array<Record<string,any>>,requests:Array<Record<string,string>>,extra:Record<string,unknown>={})=>
 reconcileAnnualSecFacts({facts,cik:row.cik,periodStart:row.start,periodEnd:row.end,asOfDate:'2026-10-19',requests,...extra});

describe('SEC annual financial normalization foundation (not connected to ranking)',()=>{
 it('rejects a Company Facts payload from a different issuer rather than assigning the requested CIK',()=>{
  expect(()=>normalizeSecFinancialFacts({cik:9999999,entityName:'Other issuer',facts:{}},{cik:cases.NVDA.cik,concepts:['Revenues']})).toThrow(/CIK does not match/);
 });
 it('preserves NVIDIA FY2026 source identity, exact units, dates, accession, and broader spending without calculating FCF',()=>{
  const row=cases.NVDA;
  const facts=normalize(row,{NetCashProvidedByUsedInOperatingActivities:102718000000,PaymentsToAcquireProductiveAssets:6042000000});
  expect(fact(facts,'PaymentsToAcquireProductiveAssets')).toMatchObject({
   cik:1045810,reportingEntity:row.name,taxonomy:'us-gaap',concept:'PaymentsToAcquireProductiveAssets',value:6042000000,unit:'USD',
   periodStart:row.start,periodEnd:row.end,fiscalYear:2026,fiscalPeriod:'FY',form:'10-K',accession:row.accession,
   filedDate:row.filed,filingUrl:row.filingUrl,sourceUrl:'https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json',
   scope:{operations:'unknown',attribution:'unknown',basis:'unknown'}
  });
  const requests=[request('operating','NetCashProvidedByUsedInOperatingActivities','operating'),request('spending','PaymentsToAcquireProductiveAssets','expenditure')];
  expect(reconcile(row,facts,requests)).toMatchObject({ok:false,reason:'scope_unverified'});
  const annotated=facts.map(item=>scoped(item,'total','consolidated',item.concept==='PaymentsToAcquireProductiveAssets'?'Purchases related to property and equipment and intangible assets':'Net cash provided by operating activities'));
  const result=reconcile(row,annotated,requests);
  expect(result).toMatchObject({ok:true,reason:null,detail:expect.stringContaining('no financial methodology or derived FCF')});
  expect(result).not.toHaveProperty('fcf');
 });

 it('rejects AMD total-versus-continuing cash flow and income scope mismatches',()=>{
  const row=cases.AMD;
  const raw=normalize(row,{
   NetCashProvidedByUsedInOperatingActivities:7709000000,
   NetCashProvidedByUsedInOperatingActivitiesContinuingOperations:6493000000,
   CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations:1216000000,
   PaymentsToAcquirePropertyPlantAndEquipment:974000000,
   NetIncomeLoss:4335000000,IncomeLossFromContinuingOperations:4269000000,
   IncomeLossFromDiscontinuedOperationsNetOfTaxAttributableToReportingEntity:66000000
  });
  expect(fact(raw,'NetCashProvidedByUsedInOperatingActivities').scope.operations).toBe('total');
  expect(fact(raw,'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations').scope.operations).toBe('continuing');
  expect(fact(raw,'CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations').value).toBe(1216000000);
  const captions:Record<string,string>={
   NetCashProvidedByUsedInOperatingActivities:'Net cash provided by operating activities',
   NetCashProvidedByUsedInOperatingActivitiesContinuingOperations:'Net cash provided by operating activities of continuing operations',
   CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations:'Net cash provided by operating activities of discontinued operations',
   PaymentsToAcquirePropertyPlantAndEquipment:'Continuing investing activities: purchases of property and equipment',
   NetIncomeLoss:'Net income',
   IncomeLossFromContinuingOperations:'Income from continuing operations, net of tax',
   IncomeLossFromDiscontinuedOperationsNetOfTaxAttributableToReportingEntity:'Income from discontinued operations, net of tax'
  };
  const facts=raw.map(item=>{
   const operations=item.concept==='PaymentsToAcquirePropertyPlantAndEquipment'?'continuing':item.scope.operations==='unknown'?'total':item.scope.operations;
   const attribution=['NetIncomeLoss','IncomeLossFromContinuingOperations','IncomeLossFromDiscontinuedOperationsNetOfTaxAttributableToReportingEntity'].includes(item.concept)?'parent_attributable':'consolidated';
   return scoped(item,operations,attribution,captions[item.concept]);
  });
  expect(reconcile(row,facts,[request('operating','NetCashProvidedByUsedInOperatingActivities'),request('spending','PaymentsToAcquirePropertyPlantAndEquipment','expenditure')])).toMatchObject({ok:false,reason:'scope_mismatch'});
  expect(reconcile(row,facts,[request('operating','NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'),request('spending','PaymentsToAcquirePropertyPlantAndEquipment','expenditure')])).toMatchObject({ok:true});
  expect(reconcile(row,facts,[request('total income','NetIncomeLoss'),request('continuing income','IncomeLossFromContinuingOperations')])).toMatchObject({ok:false,reason:'scope_mismatch'});
 });

 it('preserves CrowdStrike separate software cash outlays and distinguishes consolidated from parent earnings',()=>{
  const row=cases.CRWD;
  const raw=normalize(row,{
   NetCashProvidedByUsedInOperatingActivities:1612349000,
   PaymentsToAcquirePropertyPlantAndEquipment:302108000,
   PaymentsToDevelopSoftware:68751000,
   ProfitLoss:-161165000,NetIncomeLoss:-162502000,
   NetIncomeLossAttributableToNoncontrollingInterest:1337000
  });
  expect(fact(raw,'ProfitLoss').scope.attribution).toBe('consolidated');
  expect(fact(raw,'NetIncomeLoss').scope.attribution).toBe('parent_attributable');
  expect(fact(raw,'PaymentsToDevelopSoftware').value).toBe(68751000);
  const cash=raw.filter(item=>['NetCashProvidedByUsedInOperatingActivities','PaymentsToAcquirePropertyPlantAndEquipment','PaymentsToDevelopSoftware'].includes(item.concept))
   .map(item=>scoped(item,'total','consolidated',item.concept==='PaymentsToDevelopSoftware'?'Capitalized internal-use software and website development costs':item.concept==='PaymentsToAcquirePropertyPlantAndEquipment'?'Purchases of property and equipment':'Net cash provided by operating activities'));
  const requests=[request('operating','NetCashProvidedByUsedInOperatingActivities'),request('ppe','PaymentsToAcquirePropertyPlantAndEquipment','expenditure'),request('software','PaymentsToDevelopSoftware','expenditure')];
  expect(reconcile(row,cash,requests)).toMatchObject({ok:false,reason:'overlap_unresolved'});
  expect(reconcile(row,cash,requests,{disjointEvidence:[{concepts:['PaymentsToAcquirePropertyPlantAndEquipment','PaymentsToDevelopSoftware'],filingUrl:row.filingUrl,caption:'Separate investing cash-flow lines for PP&E and internal-use software'}]})).toMatchObject({ok:true});
  expect(reconcile(row,raw,[request('consolidated income','ProfitLoss'),request('parent income','NetIncomeLoss')])).toMatchObject({ok:false,reason:'scope_mismatch'});
 });

 it('never treats missing or future-filed components as zero, but preserves a reported zero',()=>{
  const row=cases.CRWD;
  const source=normalize(row,{NetCashProvidedByUsedInOperatingActivities:1612349000,PaymentsToAcquireIntangibleAssets:0});
  const requests=[request('operating','NetCashProvidedByUsedInOperatingActivities'),request('spending','PaymentsToAcquireIntangibleAssets','expenditure')];
  expect(reconcile(row,source.filter(item=>item.concept!=='PaymentsToAcquireIntangibleAssets'),requests)).toMatchObject({ok:false,reason:'missing_fact'});
  expect(reconcile(row,source,requests,{asOfDate:'2026-03-04'})).toMatchObject({ok:false,reason:'future_filing'});
  const annotated=source.map(item=>scoped(item,'total'));
  const result=reconcile(row,annotated,requests);
  expect(result.ok).toBe(true);
  expect(result.facts.find((item:{role:string})=>item.role==='spending').fact.value).toBe(0);
 });

 it('blocks amendments, conflicting restatements, repeated filings, period drift, and accession drift',()=>{
  const row=cases.NVDA;
  const amounts={NetCashProvidedByUsedInOperatingActivities:102718000000,PaymentsToAcquireProductiveAssets:6042000000};
  const base=normalize(row,amounts).map(item=>scoped(item,'total'));
  const requests=[request('operating','NetCashProvidedByUsedInOperatingActivities'),request('spending','PaymentsToAcquireProductiveAssets','expenditure')];
  const operating=fact(base,'NetCashProvidedByUsedInOperatingActivities');
  expect(reconcile(row,[...base,{...operating,form:'10-K/A',accession:'0001045810-26-000022'}],requests)).toMatchObject({ok:false,reason:'amendment_requires_review'});
  expect(reconcile(row,[...base,{...operating,accession:'0001045810-26-000022',value:102000000000}],requests)).toMatchObject({ok:false,reason:'conflicting_facts'});
  expect(reconcile(row,[...base,{...operating,accession:'0001045810-26-000022'}],requests)).toMatchObject({ok:false,reason:'multiple_filings_require_review'});
  expect(reconcile(row,[...base,{...operating,form:'10-K/A',filedDate:'2026-11-01',accession:'0001045810-26-000022',value:1}],requests)).toMatchObject({ok:true});
  expect(reconcile(row,base.map(item=>item.concept==='PaymentsToAcquireProductiveAssets'?{...item,periodStart:'2025-01-26'}:item),requests)).toMatchObject({ok:false,reason:'incompatible_period'});
  expect(reconcile(row,base.map(item=>item.concept==='PaymentsToAcquireProductiveAssets'?{...item,accession:'0001045810-26-000022'}:item),requests)).toMatchObject({ok:false,reason:'filing_mismatch'});
  expect(reconcile(row,base.map(item=>item.concept==='PaymentsToAcquireProductiveAssets'?{...item,fiscalYear:2025}:item),requests)).toMatchObject({ok:false,reason:'fiscal_year_mismatch'});
  expect(reconcile(row,base.map(item=>item.concept==='PaymentsToAcquireProductiveAssets'?{...item,fiscalYear:null}:item),requests)).toMatchObject({ok:false,reason:'fiscal_year_unverified'});
  expect(reconcile(row,base.map(item=>item.concept==='PaymentsToAcquireProductiveAssets'?{...item,filedDate:'2026-01-24'}:item),requests)).toMatchObject({ok:false,reason:'invalid_filing_date'});
  expect(reconcile(row,base.map(item=>item.concept==='PaymentsToAcquireProductiveAssets'?{...item,sourceUrl:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json'}:item),requests)).toMatchObject({ok:false,reason:'source_mismatch'});
 });

 it('blocks known parent-child spending overlap and unsupported IFRS-only inputs',()=>{
  const row=cases.NVDA;
  const raw=normalize(row,{NetCashProvidedByUsedInOperatingActivities:102718000000,PaymentsToAcquireProductiveAssets:6042000000,PaymentsToAcquirePropertyPlantAndEquipment:1000000000});
  const facts=raw.map(item=>scoped(item,'total'));
  const operating=request('operating','NetCashProvidedByUsedInOperatingActivities');
  const broad=request('broad','PaymentsToAcquireProductiveAssets','expenditure');
  const ppe=request('ppe','PaymentsToAcquirePropertyPlantAndEquipment','expenditure');
  expect(reconcile(row,facts,[operating,broad,ppe])).toMatchObject({ok:false,reason:'overlapping_expenditures'});
  expect(reconcile(row,facts,[operating,request('broad','PaymentsToAcquireProductiveAssets'),request('ppe','PaymentsToAcquirePropertyPlantAndEquipment')])).toMatchObject({ok:false,reason:'overlapping_expenditures'});
  expect(reconcile(row,facts,[operating,broad,{...broad,role:'broad again'}])).toMatchObject({ok:false,reason:'duplicate_expenditure'});
  const ifrs=normalize(row,{CashFlowsFromUsedInOperatingActivities:102718000000,PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities:6042000000},'ifrs-full').map(item=>scoped(item,'total'));
  expect(reconcile(row,ifrs,[request('operating','CashFlowsFromUsedInOperatingActivities'),request('spending','PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities','expenditure')])).toMatchObject({ok:false,reason:'unsupported_taxonomy'});
 });
});
