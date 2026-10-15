import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {deriveSurvivalEvidence} from './survival-evidence';
import SurvivalEvidencePanel from './SurvivalEvidencePanel';
import {assessConvictionReadiness} from './conviction-readiness';
import type {SecCompany,MarketValuationClose} from './ranking-model';
const period=(year:number,value:number,filing?:string)=>({year,end:year+'-12-31',filed:filing??(year+1)+'-02-15',form:'10-K',accession:'0000000000-26-000001',value});
const sample=():SecCompany=>({ticker:'UNSEEN',name:'Unknown Public Manufacturer',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0001234567.json',retrievedAt:'2026-10-15',metrics:[
 {name:'Revenue',values:[period(2025,100000000),period(2024,80000000)]},
 {name:'Operating cash flow',values:[period(2025,15000000)]},
 {name:'Capital expenditures',values:[period(2025,5000000)]},
 {name:'Net income',values:[period(2025,5000000)]},
 {name:'Cash and cash equivalents',tag:'CashAndCashEquivalentsAtCarryingValue',values:[period(2025,21000000)]},
 {name:'Current portion of long-term debt',tag:'LongTermDebtCurrent',values:[period(2025,3000000)]},
 {name:'Long-term debt noncurrent',tag:'LongTermDebtNoncurrent',values:[period(2025,6000000)]},
 {name:'Short-term borrowings',tag:'ShortTermBorrowings',values:[period(2025,1000000)]},
 {name:'Weighted-average diluted shares',tag:'WeightedAverageNumberOfDilutedSharesOutstanding',values:[period(2025,12000000),period(2024,10000000)]}
]});
describe('Annual balance sheet and share-count evidence, without false valuation confidence',()=>{
 it('retrieves FY-matched reported cash and each debt category with SEC dates',()=>{
  const s=deriveSurvivalEvidence(sample(),'2026-10-14');
  expect(s.fiscalYear).toBe(2025);
  expect(s.fiscalEnd).toBe('2025-12-31');
  expect(s.cash).toMatchObject({value:21000000,filed:'2026-02-15',tag:'CashAndCashEquivalentsAtCarryingValue'});
  expect(s.currentDebt?.value).toBe(3000000);
  expect(s.noncurrentDebt?.value).toBe(6000000);
  expect(s.shortBorrowings?.value).toBe(1000000);
  expect(s.weightedShareChangePct).toBe(20);
  expect(s.missing.some(x=>x.includes('debt'))).toBe(false);
  expect(s.notes.some(x=>x.includes('NOT the currently outstanding shares'))).toBe(true);
 });
 it('treats a missing debt component as unknown, not a zero liability',()=>{
  const c=sample();
  c.metrics.find(m=>m.name==='Long-term debt noncurrent')!.values=[];
  const s=deriveSurvivalEvidence(c,'2026-10-14');
  expect(s.noncurrentDebt).toBeNull();
  expect(s.missing.some(x=>x.includes('Full current/noncurrent debt'))).toBe(true);
 });
 it('never uses annual disclosures filed after the research as-of date',()=>{
  const c=sample();
  c.metrics.find(x=>x.name==='Cash and cash equivalents')!.values=[period(2025,21000000,'2026-10-16')];
  c.metrics.find(x=>x.name==='Weighted-average diluted shares')!.values=[period(2025,12000000,'2026-10-16'),period(2024,10000000)];
  const s=deriveSurvivalEvidence(c,'2026-10-14');
  expect(s.cash).toBeNull();
  expect(s.weightedDilutedShares).toBeNull();
  expect(s.weightedShareChangePct).toBeNull();
 });
 it('prevents SEC operating cash flow filed after as-of date from leaking into old snapshots',()=>{
  const c=sample();
  c.metrics.find(m=>m.name==='Operating cash flow')!.values=[period(2025,15000000,'2026-10-16')];
  const s=deriveSurvivalEvidence(c,'2026-10-14');
  expect(s.freeCashFlow).toBeNull();
  expect(s.simpleCashToBurnYears).toBeNull();
 });
 it('does not substitute an unrelated fiscal period for matching liquidity balances',()=>{
  const c=sample();
  c.metrics.find(x=>x.name==='Cash and cash equivalents')!.values=[{...period(2025,21000000),end:'2025-09-30'}];
  expect(deriveSurvivalEvidence(c,'2026-10-14').cash).toBeNull();
 });
 it('shows simple cash over historical negative FCF only as a nonforecast ratio',()=>{
  const c=sample();
  c.metrics.find(m=>m.name==='Operating cash flow')!.values=[period(2025,3000000)];
  c.metrics.find(m=>m.name==='Capital expenditures')!.values=[period(2025,5000000)];
  const s=deriveSurvivalEvidence(c,'2026-10-14');
  expect(s.freeCashFlow).toBe(-2000000);
  expect(s.simpleCashToBurnYears).toBe(10.5);
  expect(s.notes.some(n=>n.includes('NOT a forecast'))).toBe(true);
 });
 it('recognizes a negative operating cash flow number as a genuine financing warning, not missing data',()=>{
  const c=sample();
  c.metrics.find(m=>m.name==='Operating cash flow')!.values=[period(2025,-5000000)];
  const s=deriveSurvivalEvidence(c,'2026-10-14');
  expect(s.freeCashFlow).toBe(-10000000);
  expect(s.simpleCashToBurnYears).toBe(2.1);
 });
 it('does not promote a strong reported balance sheet into a buy rating',()=>{
  const q:MarketValuationClose={ticker:'UNSEEN',price:12,sessionDate:'2026-10-14',feed:'IEX',provider:'Alpaca',completedSession:true};
  const assessed=assessConvictionReadiness(sample(),q,'2026-10-15');
  expect(assessed.verdict).toBe('INSUFFICIENT EVIDENCE');
  const gate=assessed.requirements.find(x=>x.key==='survival')!;
  expect(gate.status).toBe('missing');
  expect(gate.detail).toContain('21,000,000');
  expect(gate.detail).toContain('Full debt maturity');
 });
 it('displays real-source cash and dilution facts while keeping the technical audit collapsed',()=>{
  const html=renderToStaticMarkup(createElement(SurvivalEvidencePanel,{company:sample(),asOf:'2026-10-14'}));
  expect(html).toContain('Capital &amp; dilution evidence');
  expect(html).toContain('$21M');
  expect(html).toContain('20.00%');
  expect(html).toContain('Not current shares outstanding');
  expect(html).toContain('Verify SEC cash, debt, share history');
  expect(html).toContain('companyfacts/CIK0001234567.json');
 });
});
