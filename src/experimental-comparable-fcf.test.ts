import {describe,expect,it} from 'vitest';
// @ts-ignore Experimental server-side JavaScript modules are exercised directly.
import {normalizeSecFinancialFacts} from '../server/sec-financial-normalization.mjs';
// @ts-ignore Experimental server-side JavaScript modules are exercised directly.
import {calculateCandidateComparableFcfV1,CANDIDATE_FCF_VERSION} from '../server/experimental-comparable-fcf.mjs';

const filings={
 NVDA:{cik:1045810,name:'NVIDIA CORP',start:'2025-01-27',end:'2026-01-25',fy:2026,filed:'2026-02-25',accn:'0001045810-26-000021',url:'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm'},
 AMD:{cik:2488,name:'ADVANCED MICRO DEVICES INC',start:'2024-12-29',end:'2025-12-27',fy:2025,filed:'2026-02-04',accn:'0000002488-26-000018',url:'https://www.sec.gov/Archives/edgar/data/2488/000000248826000018/amd-20251227.htm'},
 CRWD:{cik:1535527,name:'CrowdStrike Holdings, Inc.',start:'2025-02-01',end:'2026-01-31',fy:2026,filed:'2026-03-05',accn:'0001535527-26-000010',url:'https://www.sec.gov/Archives/edgar/data/1535527/000153552726000010/crwd-20260131.htm'}
} as const;
type Filing=typeof filings[keyof typeof filings];
const OCF='NetCashProvidedByUsedInOperatingActivities';
const CONTINUING='NetCashProvidedByUsedInOperatingActivitiesContinuingOperations';
const AGG='PaymentsToAcquireProductiveAssets';
const PPE='PaymentsToAcquirePropertyPlantAndEquipment';
const SOFTWARE='PaymentsToDevelopSoftware';
const annual=(row:Filing,value:number,changes:Record<string,unknown>={})=>({val:value,start:row.start,end:row.end,fy:row.fy,fp:'FY',form:'10-K',filed:row.filed,accn:row.accn,...changes});
function source(row:Filing,amounts:Record<string,number|Array<Record<string,unknown>>>,taxonomy='us-gaap'){
 const facts=Object.fromEntries(Object.entries(amounts).map(([concept,entry])=>[concept,{units:{USD:Array.isArray(entry)?entry:[annual(row,entry)]}}]));
 return normalizeSecFinancialFacts({cik:row.cik,entityName:row.name,facts:{[taxonomy]:facts}},
  {cik:row.cik,concepts:Object.keys(amounts),taxonomy,filingUrls:{[row.accn]:row.url}});
}
function review(row:Filing,captions:Record<string,string>,coverage:Record<string,string>|null=null,changes:Record<string,unknown>={}){
 const sic=row===filings.CRWD?'7372':'3674';
 return {status:'reviewed_against_filing',businessType:'nonfinancial_us_gaap_operating',reviewer:'filing-fixture-review',reviewedAt:'2026-10-19',
  classification:{status:'reported',system:'SEC SIC',code:sic,sourceUrl:`https://data.sec.gov/submissions/CIK${String(row.cik).padStart(10,'0')}.json`},
  filingUrl:row.url,accession:row.accn,operationsScope:'total',attributionScope:'consolidated',
  cashFlowStatementCaption:'Consolidated statements of cash flows',coverageNote:'Original filing investing section reviewed for separately reported productive cash purchases; omissions are not zero facts.',
  factCaptions:captions,componentCoverage:coverage,separateCashLines:[],...changes};
}
const query=(row:Filing,facts:unknown[],operatingConcept:string,spendingConcepts:string[],filingReview:unknown,changes:Record<string,unknown>={})=>
 calculateCandidateComparableFcfV1({facts,cik:row.cik,periodStart:row.start,periodEnd:row.end,asOfDate:'2026-10-19',operatingConcept,spendingConcepts,review:filingReview,...changes});

describe('experimental comparable FCF v1: never connected to production ranking',()=>{
 it('calculates NVIDIA FY2026 from the reviewed aggregate and excludes component double counting',()=>{
  const row=filings.NVDA;
  const facts=source(row,{[OCF]:102718000000,[AGG]:6042000000});
  const filingReview=review(row,{[OCF]:'Net cash provided by operating activities',[AGG]:'Purchases related to property and equipment and intangible assets'});
  const result=query(row,facts,OCF,[AGG],filingReview);
  expect(result).toMatchObject({ok:true,formulaVersion:CANDIDATE_FCF_VERSION,value:96676000000,unit:'USD',
   inputs:{operatingCashFlow:102718000000,productiveCashPurchases:6042000000,spendingMode:'aggregate'},
   reportingScope:{operations:'total',attribution:'consolidated'},provenance:{accession:row.accn,filingUrl:row.url,reviewIsIndependentlyVerified:false}});
  expect(result.selectedFacts).toHaveLength(2);
  // Synthetic overlap adversary, not a claim that NVIDIA filed this PP&E amount.
  const syntheticComponent={...facts.find((item:{concept:string})=>item.concept===AGG),concept:PPE,value:1000000000};
  const overlap=query(row,[...facts,syntheticComponent],OCF,[AGG],filingReview);
  expect(overlap.excludedFacts).toContainEqual(expect.objectContaining({fact:expect.objectContaining({concept:PPE}),reason:'covered_by_aggregate'}));
  expect(query(row,[...facts,syntheticComponent],OCF,[AGG,PPE],filingReview)).toMatchObject({ok:false,value:null,reason:'overlapping_expenditures'});
 });

 it('uses AMD continuing operating cash flow with continuing PP&E, never total-company operating cash flow',()=>{
  const row=filings.AMD;
  const facts=source(row,{[OCF]:7709000000,[CONTINUING]:6493000000,[PPE]:974000000});
  const captions={[OCF]:'Net cash provided by operating activities',[CONTINUING]:'Net cash provided by operating activities of continuing operations',[PPE]:'Continuing investing activities: purchases of property and equipment'};
  const filingReview=review(row,captions,{ppe:'selected',software:'verified_no_separate_cash_purchase',intangible:'verified_no_separate_cash_purchase'},
   {operationsScope:'continuing',coverageNote:'Continuing investing section reviewed; the $38 million discontinued-operation PP&E purchase is excluded, and no separate continuing software/intangible cash purchase was identified.'});
  expect(query(row,facts,OCF,[PPE],filingReview)).toMatchObject({ok:false,reason:'scope_review_mismatch'});
  const result=query(row,facts,CONTINUING,[PPE],filingReview);
  expect(result).toMatchObject({ok:true,value:5519000000,inputs:{operatingCashFlow:6493000000,productiveCashPurchases:974000000},reportingScope:{operations:'continuing'}});
  expect(result.excludedFacts).toContainEqual(expect.objectContaining({fact:expect.objectContaining({concept:OCF})}));
 });

 it('includes CrowdStrike separately reported PP&E and capitalized software, not strategic acquisitions',()=>{
  const row=filings.CRWD;
  const facts=source(row,{[OCF]:1612349000,[PPE]:302108000,[SOFTWARE]:68751000});
  const filingReview=review(row,{[OCF]:'Net cash provided by operating activities',[PPE]:'Purchases of property and equipment',[SOFTWARE]:'Capitalized internal-use software and website development costs'},
   {ppe:'selected',software:'selected',intangible:'verified_no_separate_cash_purchase'},
   {coverageNote:'Investing statement has separate PP&E and capitalized-software lines; intangible-purchase line shows no FY2026 cash outlay.',
    separateCashLines:[{concepts:[PPE,SOFTWARE],filingUrl:row.url,accession:row.accn,caption:'Separate investing cash-flow lines for PP&E and internal-use software',reviewed:true}]});
  const result=query(row,facts,OCF,[PPE,SOFTWARE],filingReview);
  expect(result).toMatchObject({ok:true,value:1241490000,inputs:{operatingCashFlow:1612349000,productiveCashPurchases:370859000}});
  expect(result.selectedFacts).toHaveLength(3);
  expect(query(row,facts,OCF,[PPE,SOFTWARE],{...filingReview,separateCashLines:[]})).toMatchObject({ok:false,reason:'overlap_unresolved'});
 });

 it('preserves reported zero spending and negative operating cash flow without interpreting absence as zero',()=>{
  const row=filings.CRWD;
  const facts=source(row,{[OCF]:-100000000,[PPE]:0});
  const filingReview=review(row,{[OCF]:'Net cash used in operating activities',[PPE]:'Purchases of property and equipment'},
   {ppe:'selected',software:'verified_no_separate_cash_purchase',intangible:'verified_no_separate_cash_purchase'});
  expect(query(row,facts,OCF,[PPE],filingReview)).toMatchObject({ok:true,value:-100000000,inputs:{productiveCashPurchases:0}});
  expect(query(row,facts.filter((item:{concept:string})=>item.concept!==PPE),OCF,[PPE],filingReview)).toMatchObject({ok:false,reason:'missing_fact',value:null});
  expect(query(row,source(row,{[OCF]:-100000000,[PPE]:-1}),OCF,[PPE],filingReview)).toMatchObject({ok:false,reason:'invalid_cash_purchase'});
 });

 it('withholds mismatched dates, fiscal scopes, future filings, and unsupported taxonomy',()=>{
  const row=filings.NVDA;
  const facts=source(row,{[OCF]:102718000000,[AGG]:6042000000});
  const filingReview=review(row,{[OCF]:'Net cash provided by operating activities',[AGG]:'Purchases related to property and equipment and intangible assets'});
  expect(query(row,facts.map((item:{concept:string})=>item.concept===AGG?{...item,periodStart:'2025-01-26'}:item),OCF,[AGG],filingReview)).toMatchObject({ok:false,reason:'incompatible_period'});
  expect(query(row,facts,OCF,[AGG],{...filingReview,operationsScope:'continuing'})).toMatchObject({ok:false,reason:'scope_review_mismatch'});
  expect(query(row,facts,OCF,[AGG],filingReview,{asOfDate:'2026-02-24'})).toMatchObject({ok:false,reason:'filing_review_required'});
  expect(query(row,facts,OCF,[AGG],{...filingReview,reviewedAt:'2026-02-24'},{asOfDate:'2026-02-24'})).toMatchObject({ok:false,reason:'future_filing'});
  const ifrs=source(row,{[OCF]:102718000000,[AGG]:6042000000},'ifrs-full');
  expect(query(row,ifrs,OCF,[AGG],filingReview)).toMatchObject({ok:false,reason:'unsupported_taxonomy'});
 });

 it('requires a reviewed complete spending composition and authentic cash-flow concepts',()=>{
  const row=filings.CRWD;
  const facts=source(row,{[OCF]:1612349000,[PPE]:302108000,[SOFTWARE]:68751000});
  const filingReview=review(row,{[OCF]:'Net cash provided by operating activities',[PPE]:'Purchases of property and equipment'},
   {ppe:'selected',software:'verified_no_separate_cash_purchase',intangible:'verified_no_separate_cash_purchase'});
  expect(query(row,facts,OCF,[PPE],filingReview)).toMatchObject({ok:false,reason:'unselected_expenditure_fact'});
  expect(query(row,facts.filter((item:{concept:string})=>item.concept!==SOFTWARE),OCF,[PPE],{...filingReview,componentCoverage:{ppe:'selected'}})).toMatchObject({ok:false,reason:'spending_coverage_unverified'});
  expect(query(row,facts,OCF,['PaymentsToAcquireBusinessesNetOfCashAcquired'],filingReview)).toMatchObject({ok:false,reason:'unsupported_selection'});
  expect(query(row,facts,OCF,[PPE],{...filingReview,status:'unverified'})).toMatchObject({ok:false,reason:'filing_review_required'});
  expect(query(row,facts,OCF,[PPE],{...filingReview,classification:{...filingReview.classification,code:'6022'}})).toMatchObject({ok:false,reason:'specialized_business'});
  expect(query(row,facts.filter((item:{concept:string})=>item.concept!==SOFTWARE),OCF,[PPE],{...filingReview,factCaptions:{[OCF]:'Net cash provided by operating activities'}})).toMatchObject({ok:false,reason:'unverified_filing_caption'});
 });

 it('rejects amendments, conflicting restatements, and mixed accessions rather than silently selecting one',()=>{
  const row=filings.NVDA;
  const facts=source(row,{[OCF]:102718000000,[AGG]:6042000000});
  const filingReview=review(row,{[OCF]:'Net cash provided by operating activities',[AGG]:'Purchases related to property and equipment and intangible assets'});
  const operating=facts.find((item:{concept:string})=>item.concept===OCF)!;
  expect(query(row,[...facts,{...operating,form:'10-K/A',accession:'0001045810-26-000022'}],OCF,[AGG],filingReview)).toMatchObject({ok:false,reason:'amendment_requires_review'});
  expect(query(row,[...facts,{...operating,accession:'0001045810-26-000022',value:102000000000}],OCF,[AGG],filingReview)).toMatchObject({ok:false,reason:'filing_review_mismatch'});
  expect(query(row,facts.map((item:{concept:string})=>item.concept===AGG?{...item,accession:'0001045810-26-000022'}:item),OCF,[AGG],filingReview)).toMatchObject({ok:false,reason:'filing_review_mismatch'});
 });
});
