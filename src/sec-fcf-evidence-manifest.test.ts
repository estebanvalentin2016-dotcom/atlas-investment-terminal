import {describe,expect,it} from 'vitest';
// @ts-ignore Server-side JavaScript evidence module is exercised directly.
import {buildSecFcfEvidenceManifestV1} from '../server/sec-fcf-evidence-manifest.mjs';
// @ts-ignore Experimental server-side JavaScript module is exercised directly.
import {calculateCandidateComparableFcfV1} from '../server/experimental-comparable-fcf.mjs';

const OCF='NetCashProvidedByUsedInOperatingActivities';
const PPE='PaymentsToAcquirePropertyPlantAndEquipment';
const AGG='PaymentsToAcquireProductiveAssets';
const SOFTWARE='PaymentsToDevelopSoftware';
const INTANGIBLE='PaymentsToAcquireIntangibleAssets';
type Case={ticker:string;cik:number;entity:string;accession:string;start:string;end:string;filed:string;accepted:string;document:string;sic:string;values:Record<string,number>};
// Values, accessions, and reporting dates transcribed from the original SEC annual
// filings and corresponding SEC Company Facts. These are evidence fixtures, not
// approved FCF outputs or assertions of complete capital spending.
const cases:Case[]=[
 {ticker:'NVDA',cik:1045810,entity:'NVIDIA CORP',accession:'0001045810-26-000021',start:'2025-01-27',end:'2026-01-25',filed:'2026-02-25',accepted:'2026-02-26T02:42:19.000Z',document:'nvda-20260125.htm',sic:'3674',values:{[OCF]:102718000000,[AGG]:6042000000}},
 {ticker:'AMD',cik:2488,entity:'ADVANCED MICRO DEVICES INC',accession:'0000002488-26-000018',start:'2024-12-29',end:'2025-12-27',filed:'2026-02-04',accepted:'2026-02-04T04:14:52.000Z',document:'amd-20251227.htm',sic:'3674',values:{[OCF]:7709000000,NetCashProvidedByUsedInOperatingActivitiesContinuingOperations:6493000000,CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations:1216000000,[PPE]:974000000,PaymentsForProceedsFromProductiveAssets:38000000}},
 {ticker:'CRWD',cik:1535527,entity:'CROWDSTRIKE HOLDINGS INC',accession:'0001535527-26-000010',start:'2025-02-01',end:'2026-01-31',filed:'2026-03-05',accepted:'2026-03-05T06:48:18.000Z',document:'crwd-20260131.htm',sic:'7372',values:{[OCF]:1612349000,[PPE]:302108000,[SOFTWARE]:68751000,[INTANGIBLE]:0,CapitalizedComputerSoftwareAdditions:120300000}},
 {ticker:'CAT',cik:18230,entity:'CATERPILLAR INC',accession:'0000018230-26-000008',start:'2025-01-01',end:'2025-12-31',filed:'2026-02-13',accepted:'2026-02-13T20:18:27.000Z',document:'cat-20251231.htm',sic:'3531',values:{[OCF]:11739000000,[PPE]:2821000000,PaymentsToAcquireEquipmentOnLease:1465000000,PaymentsToAcquireFinanceReceivables:15329000000}},
 {ticker:'WMT',cik:104169,entity:'WALMART INC',accession:'0000104169-26-000055',start:'2025-02-01',end:'2026-01-31',filed:'2026-03-13',accepted:'2026-03-14T00:06:24.000Z',document:'wmt-20260131.htm',sic:'5331',values:{[OCF]:41565000000,[PPE]:26642000000,FinanceLeasePrincipalPayments:891000000}},
 {ticker:'F',cik:37996,entity:'FORD MOTOR CO',accession:'0000037996-26-000015',start:'2025-01-01',end:'2025-12-31',filed:'2026-02-10',accepted:'2026-02-11T05:08:37.000Z',document:'f-20251231.htm',sic:'3711',values:{[OCF]:21282000000,[AGG]:8815000000,PaymentsToAcquireLoansAndLeasesHeldForInvestment:55747000000}},
 {ticker:'KO',cik:21344,entity:'COCA COLA CO',accession:'0001628280-26-010047',start:'2025-01-01',end:'2025-12-31',filed:'2026-02-20',accepted:'2026-02-20T14:46:32.000Z',document:'ko-20251231.htm',sic:'2080',values:{[OCF]:7408000000,[PPE]:2112000000}},
 {ticker:'JPM',cik:19617,entity:'JPMORGAN CHASE & CO',accession:'0001628280-26-008131',start:'2025-01-01',end:'2025-12-31',filed:'2026-02-13',accepted:'2026-02-14T02:20:00.000Z',document:'jpm-20251231.htm',sic:'6021',values:{[OCF]:-147782000000}}
];
const url=(c:Case)=>`https://www.sec.gov/Archives/edgar/data/${c.cik}/${c.accession.replaceAll('-','')}/${c.document}`;
function inputs(c:Case){
 const facts=Object.fromEntries(Object.entries(c.values).map(([concept,val])=>[concept,{units:{USD:[{val,start:c.start,end:c.end,fy:Number(c.end.slice(0,4)),fp:'FY',form:'10-K',filed:c.filed,accn:c.accession}]}}]));
 return {companyFacts:{cik:c.cik,entityName:c.entity,facts:{'us-gaap':facts}},submissions:{cik:c.cik,sic:c.sic,sicDescription:'SEC reported description',filings:{recent:{accessionNumber:[c.accession],form:['10-K'],reportDate:[c.end],filingDate:[c.filed],acceptanceDateTime:[c.accepted],primaryDocument:[c.document]}}},cik:c.cik,filingAccession:c.accession,asOfDate:'2026-10-20'};
}
const codes=(manifest:any)=>manifest.reviewRequired.map((item:any)=>item.code);

describe('filing-bound SEC FCF evidence manifest',()=>{
 it.each(cases)('preserves $ticker original-filing identity and reported values without approval',c=>{
  const manifest=buildSecFcfEvidenceManifestV1(inputs(c));
  expect(manifest.ok).toBe(true);
  expect(manifest.status).toBe('review_required');
  expect(manifest.version).toBe('sec-fcf-evidence-manifest-v1');
  expect(manifest.cik).toBe(c.cik);
  expect(manifest.filing.url).toBe(url(c));
  expect(manifest.filing.acceptedAt).toBe(c.accepted);
  expect(manifest.period).toEqual({start:c.start,end:c.end,fiscalYear:Number(c.end.slice(0,4)),currency:'USD'});
  const observed=[...Object.values(manifest.observations).flat()].filter((fact:any)=>fact.concept);
  for(const [concept,value] of Object.entries(c.values)){
   expect(observed.some((fact:any)=>fact.concept===concept&&fact.value===value&&fact.unit==='USD'&&fact.accession===c.accession&&fact.filingUrl===url(c))).toBe(true);
  }
  expect(codes(manifest)).toContain('caption_and_completeness_review');
  const candidate=calculateCandidateComparableFcfV1({...manifest.candidateContext,operatingConcept:OCF,spendingConcepts:[PPE]});
  expect(candidate.ok).toBe(false);
 });
 it('keeps AMD total, continuing, and discontinued cash flows distinct',()=>{
  const m=buildSecFcfEvidenceManifestV1(inputs(cases[1]));
  expect(m.observations.operatingCashFlow.map((f:any)=>[f.concept,f.value,f.scope.operations])).toEqual(expect.arrayContaining([
   [OCF,7709000000,'total'],['NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',6493000000,'continuing'],['CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations',1216000000,'discontinued']]));
  expect(codes(m)).toContain('discontinued_operations_scope');
  expect(codes(m)).not.toContain('incompatible_period');
  expect(m.observations.contextualFacts.some((f:any)=>f.concept==='PaymentsForProceedsFromProductiveAssets')).toBe(true);
 });
 it.each<{caseIndex:number;years:Array<{start:string;end:string;fy:number;ocf:number;spending:number}>}>([
  // SEC Company Facts `fy` identifies the filing's fiscal year even for its prior-year columns.
  {caseIndex:0,years:[
   {start:'2024-01-29',end:'2025-01-26',fy:2026,ocf:64089000000,spending:3236000000},
   {start:'2023-01-30',end:'2024-01-28',fy:2026,ocf:28090000000,spending:1069000000}]},
  {caseIndex:6,years:[
   {start:'2024-01-01',end:'2024-12-31',fy:2025,ocf:6805000000,spending:2064000000},
   {start:'2023-01-01',end:'2023-12-31',fy:2025,ocf:11599000000,spending:1852000000}]}
 ])('retains genuine $caseIndex comparative-year columns as history, not target conflicts',({caseIndex,years})=>{
  const base=inputs(cases[caseIndex]);
  const spending=caseIndex===0?AGG:PPE;
  for(const concept of [OCF,spending]){
   const rows=base.companyFacts.facts['us-gaap'][concept].units.USD;
   for(const year of years)rows.push({...rows[0],start:year.start,end:year.end,fy:year.fy,
    val:concept===OCF?year.ocf:year.spending});
  }
  const m=buildSecFcfEvidenceManifestV1(base);
  expect(m.observations.historicalComparatives).toHaveLength(4);
  expect(m.observations.historicalComparatives.every((f:any)=>f.periodEnd<cases[caseIndex].end)).toBe(true);
  expect(m.observations.historicalComparatives.every((f:any)=>f.fiscalYear===Number(cases[caseIndex].end.slice(0,4)))).toBe(true);
  expect(m.observations.incompatiblePeriod).toHaveLength(0);
  expect(codes(m)).not.toContain('incompatible_period');
  expect(m.candidateContext).not.toBeNull();
  expect(m.candidateContext.facts.every((f:any)=>f.periodEnd===cases[caseIndex].end)).toBe(true);
 });
 it('retains CRWD reported zero and treats software additions as context, not cash spending',()=>{
  const m=buildSecFcfEvidenceManifestV1(inputs(cases[2]));
  expect(m.observations.reportedZeros).toEqual(expect.arrayContaining([expect.objectContaining({concept:INTANGIBLE,value:0})]));
  expect(m.observations.cashPurchases.some((f:any)=>f.concept==='CapitalizedComputerSoftwareAdditions')).toBe(false);
  expect(m.observations.contextualFacts).toEqual(expect.arrayContaining([expect.objectContaining({concept:'CapitalizedComputerSoftwareAdditions'})]));
  expect(codes(m)).toContain('software_intangible_overlap_review');
 });
 it('flags financing activity from facts even when the company SIC is nonfinancial',()=>{
  for(const c of [cases[3],cases[5]])expect(codes(buildSecFcfEvidenceManifestV1(inputs(c)))).toContain('possible_financing_business');
  expect(codes(buildSecFcfEvidenceManifestV1(inputs(cases[4])))).toContain('financing_asset_payment_review');
  expect(codes(buildSecFcfEvidenceManifestV1(inputs(cases[7])))).toContain('unsupported_financial_sector');
  expect(codes(buildSecFcfEvidenceManifestV1(inputs(cases[6])))).not.toContain('possible_financing_business');
 });
 it('does not mistake an absent purchase component for a reported zero',()=>{
  const m=buildSecFcfEvidenceManifestV1(inputs(cases[6]));
  expect(m.observations.reportedZeros).toHaveLength(0);
  expect(codes(m)).toContain('component_coverage_unknown');
 });
 it('retains an unverified filing-line note without treating it as a normalized fact',()=>{
  const c=cases[0];
  const m=buildSecFcfEvidenceManifestV1({...inputs(c),filingLineObservations:[{accession:c.accession,filingUrl:url(c),section:'financing',caption:'Principal payments on property and equipment and intangible assets',value:101000000,unit:'USD'}]});
  expect(m.observations.callerSuppliedFilingLines[0].provenanceMode).toBe('caller_supplied_filing_excerpt_unverified');
  expect(m.candidateContext.facts.some((f:any)=>f.value===101000000)).toBe(false);
  expect(codes(m)).toContain('filing_excerpt_review');
 });
 it('flags aggregate overlap, incompatible periods, and conflicting duplicated facts',()=>{
  const base=inputs(cases[0]);
  const usd=(concept:string)=>base.companyFacts.facts['us-gaap'][concept].units.USD;
  usd(AGG).push({...usd(AGG)[0],val:6043000000});
  base.companyFacts.facts['us-gaap'][PPE]={units:{USD:[{...usd(AGG)[0],val:5000000000},{...usd(AGG)[0],start:'2025-02-01',val:1}]}};
  const m=buildSecFcfEvidenceManifestV1(base);
  expect(codes(m)).toEqual(expect.arrayContaining(['aggregate_component_overlap','conflicting_facts','incompatible_period']));
 });
 it('blocks a target-year spending fact with a conflicting fiscal-year designation',()=>{
  const base=inputs(cases[6]);
  base.companyFacts.facts['us-gaap'][PPE].units.USD[0].fy=2024;
  const m=buildSecFcfEvidenceManifestV1(base);
  expect(codes(m)).toContain('incompatible_period');
  expect(m.observations.incompatiblePeriod).toEqual(expect.arrayContaining([expect.objectContaining({concept:PPE,fiscalYear:2024})]));
  expect(m.candidateContext).toBeNull();
 });
 it('flags later amended/restated facts without substituting them into the chosen accession',()=>{
  const base=inputs(cases[6]);
  const amended='0001628280-26-099999';
  const recent=base.submissions.filings.recent;
  recent.accessionNumber.push(amended);recent.form.push('10-K/A');recent.reportDate.push(cases[6].end);recent.filingDate.push('2026-05-01');recent.acceptanceDateTime.push('2026-05-01T12:00:00Z');recent.primaryDocument.push('amended.htm');
  base.companyFacts.facts['us-gaap'][PPE].units.USD.push({...base.companyFacts.facts['us-gaap'][PPE].units.USD[0],val:2200000000,accn:amended,filed:'2026-05-01',form:'10-K/A'});
  const m=buildSecFcfEvidenceManifestV1(base);
  expect(codes(m)).toEqual(expect.arrayContaining(['amendment_requires_review','restatement_conflict']));
  expect(m.observations.cashPurchases.find((f:any)=>f.concept===PPE).value).toBe(2112000000);
 });
 it('withholds context when filing was accepted after assessment date',()=>{
  const m=buildSecFcfEvidenceManifestV1({...inputs(cases[0]),asOfDate:'2026-02-25'});
  expect(codes(m)).toContain('not_available_as_of');
  expect(m.candidateContext).toBeNull();
 });
 it('rejects wrong issuer or accession and tolerates invalid dates without throwing',()=>{
  const base=inputs(cases[0]);
  expect(buildSecFcfEvidenceManifestV1({...base,cik:1}).reason).toBe('issuer_mismatch');
  expect(buildSecFcfEvidenceManifestV1({...base,filingAccession:'0001045810-26-999999'}).reason).toBe('filing_not_found');
  expect(buildSecFcfEvidenceManifestV1({...base,asOfDate:'2026-02-30'}).reason).toBe('invalid_request');
 });
 it('bounds repeated evidence and withholds incomplete calculator context',()=>{
  const base=inputs(cases[6]);
  const first=base.companyFacts.facts['us-gaap'][PPE].units.USD[0];
  base.companyFacts.facts['us-gaap'][PPE].units.USD=Array.from({length:81},()=>({...first}));
  const m=buildSecFcfEvidenceManifestV1(base);
  expect(m.observations.cashPurchases).toHaveLength(80);
  expect(codes(m)).toContain('manifest_truncated');
  expect(m.candidateContext).toBeNull();
 });
});
