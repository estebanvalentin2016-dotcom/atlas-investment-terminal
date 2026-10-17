import {describe,expect,it} from 'vitest';
import {consensusFromReports,reportingRecordsFrom13F,FUND_SOURCE_STATUS,type InstitutionRecord} from './institutional-consensus';
const base=(managerCik:string):InstitutionRecord=>({
 managerCik,managerName:'Example Reporting Manager '+managerCik,familyId:null,independenceEvidence:null,
 strategy:'unknown',strategyEvidence:null,kind:'13f',fundId:null,disclosureFrequency:'quarterly',
 asOfDate:'2026-06-30',publishedDate:'2026-08-14',
 sourceUrl:'https://www.sec.gov/Archives/edgar/data/1000/000000000026000001/info.xml',
 key:'037833100|COM',cusip:'037833100',issuer:'APPLE INC',className:'COM',
 shares:100,priorShares:50,weightPct:2.5,change:'reported_increase'
});
describe('ATLAS cross-institutional evidence gates',()=>{
 it('does not infer active investment consensus from multiple ordinary 13F reports',()=>{
  const groups=consensusFromReports([base('111'),base('222')]);
  expect(groups).toHaveLength(1);
  expect(groups[0].reportedManagers).toBe(2);
  expect(groups[0].provisionalInterest).toBe(2);
  expect(groups[0].verifiedActiveFamilies).toBe(0);
  expect(groups[0].signal).toBe('insufficient_independence_evidence');
 });
 it('does not double count affiliated managers sharing a verified family',()=>{
  const active=(cik:string,family:string):InstitutionRecord=>({...base(cik),familyId:family,independenceEvidence:'https://www.sec.gov/filings/fund-affiliates',strategy:'verified_active',strategyEvidence:'https://www.sec.gov/filings/investment-mandate'});
  const result=consensusFromReports([active('101','same-family'),active('102','same-family')])[0];
  expect(result.reportedManagers).toBe(2);
  expect(result.verifiedActiveFamilies).toBe(1);
  expect(result.activeEmergingFamilies).toBe(1);
  expect(result.signal).toBe('insufficient_independence_evidence');
 });
 it('separates verified passive/index reporting from two verified independent active mandates',()=>{
  const active=(cik:string,family:string):InstitutionRecord=>({...base(cik),familyId:family,independenceEvidence:'https://www.sec.gov/filings/affiliate-map',strategy:'verified_active',strategyEvidence:'https://www.sec.gov/filings/active-fund-mandate'});
  const passive:InstitutionRecord={...base('300'),familyId:'index-provider',independenceEvidence:'https://www.sec.gov/passive/affiliation',strategy:'verified_passive',strategyEvidence:'https://www.sec.gov/passive/index-prospectus'};
  const result=consensusFromReports([active('101','a'),active('202','b'),passive])[0];
  expect(result.reportedManagers).toBe(3);
  expect(result.passiveFamilies).toBe(1);
  expect(result.verifiedActiveFamilies).toBe(2);
  expect(result.activeEmergingFamilies).toBe(2);
  expect(result.signal).toBe('verified_active_convergence');
 });
 it('requires an actual new or increased position for emerging active convergence',()=>{
  const active=(cik:string,family:string):InstitutionRecord=>({...base(cik),familyId:family,independenceEvidence:'https://www.sec.gov/family',strategy:'verified_active',strategyEvidence:'https://www.sec.gov/mandate',change:'unchanged'});
  const result=consensusFromReports([active('101','a'),active('102','b')])[0];
  expect(result.verifiedActiveFamilies).toBe(2);
  expect(result.activeEmergingFamilies).toBe(0);
  expect(result.signal).toBe('insufficient_independence_evidence');
 });
 it('never combines different quarterly or daily point-in-time disclosures',()=>{
  const other={...base('222'),asOfDate:'2026-09-30',publishedDate:'2026-11-14'};
  expect(consensusFromReports([base('111'),other])).toHaveLength(2);
 });
 it('discards record rows with publication dates earlier than holding dates',()=>{
  const bad={...base('222'),publishedDate:'2026-05-01'};
  const result=consensusFromReports([base('111'),bad]);
  expect(result).toHaveLength(1);
  expect(result[0].reportedManagers).toBe(1);
 });
 it('maps selected 13F data into explicitly unclassified manager reports',()=>{
  const rows=reportingRecordsFrom13F({cik:'1234567',manager:'Test Firm',latest:{period:'2026-06-30',filed:'2026-08-14',sourceUrl:'https://www.sec.gov/x.xml'},rows:[{key:'037833100|COM',cusip:'037833100',issuer:'APPLE INC',className:'COM',shares:50,previousShares:40,portfolioPct:12,change:'reported_increase'}]});
  expect(rows).toHaveLength(1);
  expect(rows[0].strategy).toBe('unknown');
  expect(rows[0].familyId).toBeNull();
  expect(rows[0].publishedDate).toBe('2026-08-14');
 });
 it('labels the major ETF provider adapters pending until verifiable fund files are connected',()=>{
  expect(FUND_SOURCE_STATUS.map(x=>x.provider)).toEqual(['Vanguard','BlackRock / iShares','State Street / SPDR']);
  expect(FUND_SOURCE_STATUS.every(x=>x.status==='source adapter pending')).toBe(true);
 });
});
