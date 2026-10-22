import {describe,expect,it} from 'vitest';
import {assessFinancialMethodologyEligibility,PP_AND_E_FCF_DISCLOSURE} from './financial-methodology-eligibility';
import {initialAutonomousScreen} from './autonomous-screen';
import {deriveRankingMetrics,scoreCompany,defaultRankWeights,type SecCompany} from './ranking-model';
import {assessConvictionReadiness} from './conviction-readiness';
import {assessEconomicSignificance} from './economic-significance';

const asOf='2026-10-20';
const fact=(year:number,value:number,accession:string)=>({year,start:`${year}-01-01`,end:`${year}-12-31`,filed:year===2025?'2026-03-01':'2025-03-01',value,unit:'USD',form:'10-K',accession,reviewIssues:[] as string[]});
function company(ticker:string,cik:string,sic:string,accession='0000000000-26-000001'):SecCompany{
 return {ticker,name:`${ticker} fixture`,cik,source:`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,retrievedAt:'2026-10-20T12:00:00.000Z',
  classification:{status:'reported',system:'SEC SIC',code:sic,description:'SEC SIC fixture',source:`https://data.sec.gov/submissions/CIK${cik}.json`,retrievedAt:'2026-10-20T12:00:00.000Z'},
  metrics:[
   {name:'Revenue',unit:'USD',tag:'Revenues',reportingScope:'entity_wide',values:[fact(2025,150,accession),fact(2024,100,'0000000000-25-000001')]},
   {name:'Operating cash flow',unit:'USD',tag:'NetCashProvidedByUsedInOperatingActivities',reportingScope:'total_operations',values:[fact(2025,38,accession)]},
   {name:'Capital expenditures',unit:'USD',tag:'PaymentsToAcquirePropertyPlantAndEquipment',reportingScope:'unallocated_cash_purchases',values:[fact(2025,8,accession)]},
   {name:'Net income',unit:'USD',tag:'NetIncomeLoss',reportingScope:'parent_attributable',values:[fact(2025,30,accession)]}
  ]};
}

describe('ordinary-company methodology eligibility',()=>{
 it('blocks a SEC SIC bank from an ordinary FCF pass and weighted rank without hiding source facts',()=>{
  const jpm=company('JPM','0000019617','6021');
  expect(assessFinancialMethodologyEligibility(jpm,asOf).status).toBe('financial_institution');
  expect(deriveRankingMetrics(jpm,null,asOf).fcf).toBe(30);
  expect(initialAutonomousScreen(jpm,asOf).status).not.toBe('preliminary_pass');
  expect(scoreCompany(jpm,defaultRankWeights,null,asOf).score).toBeNull();
  const readiness=assessConvictionReadiness(jpm,null,asOf);
  expect(readiness.observed.freeCashFlow).toBeNull();
  expect(readiness.fundingRisk.status).toBe('unknown');
 });
 it.each([
  ['CAT','0000018230','3531','0000018230-26-000008','PaymentsToAcquireFinanceReceivables'],
  ['F','0000037996','3711','0000037996-26-000015','PaymentsToAcquireLoansAndLeasesHeldForInvestment']
 ])('requires filing-bound mixed-financing review for %s',(_ticker,cik,sic,accession,concept)=>{
  const issuer=company(_ticker,cik,sic,accession);
  const decision=assessFinancialMethodologyEligibility(issuer,asOf);
  expect(decision.status).toBe('mixed_financing_review');
  expect(decision.reason).toContain(accession);
  expect(decision.reason).toContain(concept);
  expect(decision.source).toMatch(/^https:\/\/www\.sec\.gov\/Archives\//);
  expect(scoreCompany(issuer,defaultRankWeights,null,asOf).score).toBeNull();
  expect(initialAutonomousScreen(issuer,asOf).status).not.toBe('preliminary_pass');
 });
 it('does not leak later filing evidence into an earlier assessment',()=>{
  const cat=company('CAT','0000018230','3531');
  expect(assessFinancialMethodologyEligibility(cat,'2026-02-12').status).toBe('unknown');
 });
 it('withholds unknown or stale SIC rather than granting a provisional pass',()=>{
  const issuer=company('UNKNOWN','0000123456','3531');
  delete issuer.classification;
  expect(assessFinancialMethodologyEligibility(issuer,asOf).status).toBe('unknown');
  expect(initialAutonomousScreen(issuer,asOf).status).toBe('accounting_review');
  expect(scoreCompany(issuer,defaultRankWeights,null,asOf).score).toBeNull();
 });
 it.each([
  ['WMT','0000104169','5331'],['KO','0000021344','2080'],['CRWD','0001535527','7372']
 ])('preserves %s PP&E-only arithmetic while limiting the claim',(_ticker,cik,sic)=>{
  const issuer=company(_ticker,cik,sic);
  const decision=assessFinancialMethodologyEligibility(issuer,asOf);
  expect(decision.status).toBe('provisional_operating');
  expect(decision.reason).toContain('provisional');
  expect(deriveRankingMetrics(issuer,null,asOf).fcf).toBe(30);
  expect(PP_AND_E_FCF_DISCLOSURE).toContain('non-GAAP');
  expect(PP_AND_E_FCF_DISCLOSURE).toContain('software development');
 });
 it('retains accession and date safeguards and excludes the experimental productive-assets method',()=>{
  const issuer=company('TEST','0000123456','3531');
  issuer.metrics.find(metric=>metric.name==='Capital expenditures')!.values[0].accession='0000000000-26-999999';
  expect(deriveRankingMetrics(issuer,null,asOf).fcf).toBeNull();
  expect(initialAutonomousScreen(issuer,asOf).status).toBe('incomplete_financials');
  expect(scoreCompany(issuer,defaultRankWeights,null,asOf).metrics.fcf).toBeNull();
  expect(deriveRankingMetrics(company('TEST','0000123456','3531'),null,'2026-02-28').fcf).toBeNull();
 });
 it('withholds Catalyst annual FCF reference for an ineligible company',()=>{
  const jpm=company('JPM','0000019617','6021');
  const result=assessEconomicSignificance({ticker:'JPM',filingUrl:'https://www.sec.gov/Archives/edgar/data/19617/filing.htm',asOf,review:null,company:jpm});
  expect(result.annual?.fcf).toBeNull();
  expect(result.annual?.fcfMarginPct).toBeNull();
  expect(result.sensitivity).toBeNull();
 });
});
