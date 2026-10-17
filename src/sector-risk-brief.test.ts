import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {assessSectorRisk,isBankIssuer} from './sector-risk-brief';
import {createConvictionActionBrief} from './conviction-action-brief';
import ConvictionActionPanel from './ConvictionActionPanel';
import {assessConvictionReadiness} from './conviction-readiness';
import {deriveOperatingScenarios} from './operating-scenarios';
import type {SecCompany,MarketValuationClose} from './ranking-model';
const filing=(year:number,v:number)=>({year,end:year+'-12-31',filed:(year+1)+'-02-27',form:'10-K',accession:'0000714395-26-000101',value:v});
const q=(value:number,end='2026-06-30')=>({year:2026,end,filed:'2026-08-06',form:'10-Q',accession:'0000714395-26-000085',value});
const bank=():SecCompany=>({ticker:'GABC',name:'German American Bancorp, Inc.',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000714395.json',retrievedAt:'2026-10-16T00:00:00Z',metrics:[
 {name:'Revenue',values:[filing(2025,487400000),filing(2024,353700000)]},
 {name:'Operating cash flow',values:[filing(2025,156000000)]},
 {name:'Capital expenditures',values:[filing(2025,1999000)]},
 {name:'Net income',values:[filing(2025,119000000)]},
 {name:'Diluted EPS',values:[filing(2025,3.06)]},
 {name:'Latest total assets',tag:'Assets',values:[q(7100000000)]},
 {name:'Latest stockholders equity',tag:'StockholdersEquity',values:[q(820000000)]},
 {name:'Latest customer deposits',tag:'Deposits',values:[q(6100000000)]},
 {name:'Latest loans receivable',tag:'LoansAndLeasesReceivableNetReportedAmount',values:[q(5200000000)]},
 {name:'Latest loan-loss allowance',tag:'AllowanceForLoanAndLeaseLosses',values:[q(68000000)]}
]});
const quote:MarketValuationClose={ticker:'GABC',price:49.57,sessionDate:'2026-10-15',feed:'IEX',provider:'Alpaca',completedSession:true};
describe('Bank-specific automated investment research context',()=>{
 it('detects bancorp names without classifying regular firms as banks',()=>{
  expect(isBankIssuer('German American Bancorp, Inc.')).toBe(true);
  expect(isBankIssuer('Fifth Third Bancorp')).toBe(true);
  expect(isBankIssuer('Retail Bank Co')).toBe(true);
  expect(isBankIssuer('Bankruptcy Holdings')).toBe(false);
  expect(isBankIssuer('Bank of America Corp')).toBe(true);
  expect(isBankIssuer('BlackRock, Inc.')).toBe(false);
 });
 it('derives explicitly dated bank equity, deposit and loan ratios, not regulatory CET1',()=>{
  const e=assessSectorRisk(bank(),'2026-10-16');
  expect(e.sector).toBe('bank');
  expect(e.status).toBe('source_backed_partial');
  expect(e.equityAssetsPct).toBeCloseTo(11.55,2);
  expect(e.depositsAssetsPct).toBeCloseTo(85.92,2);
  expect(e.loansAssetsPct).toBeCloseTo(73.24,2);
  expect(e.balance.assets?.end).toBe('2026-06-30');
  expect(e.warnings.join(' ')).toContain('CET1');
 });
 it('does not invent missing deposits, cash, credit ratios or mix different dates',()=>{
  const b=bank();
  b.metrics=b.metrics.filter(x=>x.name!=='Latest customer deposits');
  b.metrics.find(x=>x.name==='Latest stockholders equity')!.values=[q(820000000,'2026-03-31')];
  const x=assessSectorRisk(b,'2026-10-16');
  expect(x.depositsAssetsPct).toBeNull();
  expect(x.equityAssetsPct).toBeNull();
  expect(x.status).toBe('source_unavailable');
  expect(x.nextEvidence).toContain('CET1');
 });
 it('excludes financial facts not public as of the research date',()=>{
  expect(assessSectorRisk(bank(),'2026-07-15').status).toBe('source_unavailable');
  expect(assessSectorRisk(bank(),'2026-10-16').balance.deposits?.filed).toBe('2026-08-06');
 });
 it('blocks generic bank five-year FCF moonshots and cash-runway-as-solvency conclusions',()=>{
  const b=bank();
  const scenarios=deriveOperatingScenarios(b,'2026-10-16');
  expect(scenarios.status).toBe('blocked');
  expect(scenarios.reasons.join(' ')).toContain('Bank-sector valuation');
  const assessed=assessConvictionReadiness(b,quote,'2026-10-16');
  expect(assessed.fundingRisk.status).toBe('unknown');
  expect(assessed.fundingRisk.headline).toContain('Bank capital');
  expect(assessed.requirements.find(x=>x.key==='scenarios')?.status).toBe('missing');
  const brief=createConvictionActionBrief(b,assessed,'2026-10-16');
  expect(brief.action).toBe('WATCH');
  expect(brief.headline).toContain('credit quality');
  expect(brief.nextEvidence).toContain('deposit');
  expect(brief.processedChecks).toBe(11);
  expect(brief.unclearedChecks).toBeGreaterThan(0);
  expect(brief.evidenceVerdict).toBe('INSUFFICIENT EVIDENCE');
 });
 it('shows a readable automatic decision with clear checked-vs-verified distinction',()=>{
  const b=bank(),a=assessConvictionReadiness(b,quote,'2026-10-16');
  const html=renderToStaticMarkup(createElement(ConvictionActionPanel,{company:b,assessment:a,asOf:'2026-10-16'}));
  expect(html).toContain('What ATLAS found');
  expect(html).toContain('What it means');
  expect(html).toContain('What changes this decision');
  expect(html).toContain('11/11 research questions evaluated');
  expect(html).toContain('not');
  expect(html).toContain('Book equity / assets');
  expect(html).toContain('bank solvency tests');
 });
});
