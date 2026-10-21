import {describe,expect,it} from 'vitest';
import {assessEmergingFcfStrength,deriveRankingMetrics,type SecCompany} from './ranking-model';
import {initialAutonomousScreen} from './autonomous-screen';

const A='0000000001-26-000001',B='0000000001-26-000002',OLD='0000000001-25-000001';
const fy=(year:number,value:number,accession:string)=>({year,start:`${year}-01-01`,end:`${year}-12-31`,filed:`${year+1}-02-15`,value,unit:'USD',form:'10-K',accession,reviewIssues:[] as string[]});
function company():SecCompany{return {ticker:'CASE',name:'Synthetic filing comparison',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json',retrievedAt:'2026-10-19T12:00:00Z',metrics:[
 {name:'Revenue',tag:'Revenues',unit:'USD',reportingScope:'entity_wide',values:[fy(2025,150,A),fy(2024,100,OLD)]},
 {name:'Operating cash flow',tag:'NetCashProvidedByUsedInOperatingActivities',unit:'USD',reportingScope:'total_operations',values:[fy(2025,32,A)]},
 {name:'Capital expenditures',tag:'PaymentsToAcquirePropertyPlantAndEquipment',unit:'USD',reportingScope:'unallocated_cash_purchases',values:[fy(2025,6,A)]},
 {name:'Net income',tag:'NetIncomeLoss',unit:'USD',reportingScope:'parent_attributable',values:[fy(2025,12,A)]}
]};}
const metric=(c:SecCompany,name:string)=>c.metrics.find(item=>item.name===name)!;

describe('production financial comparability',()=>{
 it('withholds FCF when either operating cash flow or PP&E comes from a different unreviewed accession',()=>{
  for(const name of ['Operating cash flow','Capital expenditures']){
   const c=company();metric(c,name).values[0].accession=B;
   const result=deriveRankingMetrics(c,null,'2026-10-19');
   expect(result.growth).toBe(50); // Different annual filings across fiscal years are normal.
   expect(result.fcf).toBeNull();
   expect(result.fcfMargin).toBeNull();
   const screen=initialAutonomousScreen(c,'2026-10-19');
   expect(screen.status).toBe('incomplete_financials');
   expect(screen.missingEvidence).toContainEqual(expect.objectContaining({metric:name,cause:'accounting_reconciliation_required'}));
  }
 });
 it('withholds net margin and multi-year FCF trend for unreviewed filing mixes',()=>{
  const c=company();metric(c,'Net income').values[0].accession=B;
  expect(deriveRankingMetrics(c,null,'2026-10-19').profitMargin).toBeNull();
  metric(c,'Net income').values[0].accession=A;
  for(const item of c.metrics){
   item.values.push(fy(2023,item.name==='Revenue'?80:item.name==='Operating cash flow'?16:item.name==='Capital expenditures'?2:5,OLD));
   if(item.name!=='Revenue')item.values.push(fy(2024,item.name==='Operating cash flow'?22:item.name==='Capital expenditures'?3:7,OLD));
  }
  metric(c,'Capital expenditures').values.find(value=>value.year===2024)!.accession=B;
  expect(assessEmergingFcfStrength(c,'2026-10-19').status).toBe('insufficient_evidence');
 });
 it('withholds missing provenance, mismatched starts, future facts, and review flags',()=>{
  for(const change of [
   (c:SecCompany)=>{metric(c,'Operating cash flow').values[0].start=undefined},
   (c:SecCompany)=>{metric(c,'Operating cash flow').values[0].unit=undefined},
   (c:SecCompany)=>{metric(c,'Operating cash flow').reportingScope=undefined},
   (c:SecCompany)=>{metric(c,'Capital expenditures').reportingScope=undefined},
   (c:SecCompany)=>{metric(c,'Operating cash flow').values[0].reviewIssues=undefined},
   (c:SecCompany)=>{metric(c,'Operating cash flow').values[0].start='2025-02-01'},
   (c:SecCompany)=>{metric(c,'Operating cash flow').values[0].filed='2026-11-01'},
   (c:SecCompany)=>{metric(c,'Operating cash flow').values[0].reviewIssues=['scope_unverified']}
  ]){const c=company();change(c);expect(deriveRankingMetrics(c,null,'2026-10-19').fcf).toBeNull()}
 });
 it('accepts a cross-accession fact only with an exact, dated filing comparison review',()=>{
  const c=company();c.cik='0000000001';metric(c,'Capital expenditures').values[0].accession=B;
  const url=(accn:string)=>`https://www.sec.gov/Archives/edgar/data/1/${accn.replaceAll('-','')}/filing.htm`;
  c.filingComparisonReviews=[{status:'reviewed_against_filings',metric:'Capital expenditures',fiscalYear:2025,
   periodStart:'2025-01-01',periodEnd:'2025-12-31',revenueAccession:A,metricAccession:B,
   revenueValue:150,metricValue:6,revenueReportingScope:'entity_wide',metricReportingScope:'unallocated_cash_purchases',operationsScope:'total_operations',reviewer:'fixture reviewer',reviewedAt:'2026-03-01',
   revenueFilingUrl:url(A),metricFilingUrl:url(B),scopeNote:'The two annual filing cash-flow observations have the same issuer, dates and operations scope.'}];
  expect(deriveRankingMetrics(c,null,'2026-10-19').fcf).toBe(26);
  c.filingComparisonReviews[0].metricValue=7;
  expect(deriveRankingMetrics(c,null,'2026-10-19').fcf).toBeNull();
  c.filingComparisonReviews[0].metricValue=6;c.filingComparisonReviews[0].reviewedAt='2026-11-01';
  expect(deriveRankingMetrics(c,null,'2026-10-19').fcf).toBeNull();
 });
});
