import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {deriveFinancingAutomation} from './financing-automation';
import FinancingAutomationPanel from './FinancingAutomationPanel';
import SurvivalEvidencePanel from './SurvivalEvidencePanel';
import {assessConvictionReadiness} from './conviction-readiness';
import type {Annual,SecCompany,SecMetric} from './ranking-model';
const filed=(val:number,end='2026-06-30',filed='2026-08-08'):Annual=>
 ({year:Number(end.slice(0,4)),end,filed,value:val,form:'10-Q',accession:'0000123456-26-000001'});
const annual=(value:number):Annual=>({year:2025,end:'2025-12-31',filed:'2026-02-15',value,form:'10-K',accession:'0000123456-26-000002'});
const item=(name:string,values:Annual[]):SecMetric=>({name,values});
const company=():SecCompany=>({ticker:'TEST',name:'Test Industry',cik:'0000123456',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000123456.json',retrievedAt:'2026-10-15',classification:{status:'reported',system:'SEC SIC',code:'3531',description:'Synthetic industrial fixture',source:'https://data.sec.gov/submissions/CIK0000123456.json',retrievedAt:'2026-10-15T12:00:00.000Z'},metrics:[
 item('Revenue',[annual(20000000),{...annual(18000000),year:2024,end:'2024-12-31',filed:'2025-02-15'}]),
 item('Operating cash flow',[annual(3000000)]),
 item('Capital expenditures',[annual(5000000)]),
 item('Weighted-average diluted shares',[annual(13600)]),
 item('Common shares outstanding (DEI)',[filed(12880000,'2026-09-03','2026-09-08')]),
 item('Latest cash and cash equivalents',[filed(10000000)]),
 item('Latest current assets',[filed(20000000)]),
 item('Latest current liabilities',[filed(12000000)]),
 item('Latest current long-term debt',[filed(1000000)]),
 item('Latest noncurrent long-term debt',[filed(3000000)]),
 item('Latest short-term borrowings',[filed(200000)]),
]});
describe('Automatic filing-backed capital and financing research',()=>{
 it('computes matching recent quarterly working capital and historical cash-to-burn stress',()=>{
  const e=deriveFinancingAutomation(company(),'2026-10-15');
  expect(e.status).toBe('recent_partial');
  expect(e.cash).toMatchObject({value:10000000,end:'2026-06-30',filed:'2026-08-08'});
  expect(e.workingCapital).toBe(8000000);
  expect(e.currentRatio).toBeCloseTo(1.67);
  expect(e.reportedDebtSubtotal).toBe(4200000);
  expect(e.debtFields).toBe(3);
  expect(e.annualFcf).toBe(-2000000);
  expect(e.cashToHistoricalBurnYears).toBe(5);
  expect(e.notes.some(x=>x.includes('NOT forecast runway'))).toBe(true);
 });
 it('flags the thousandfold EVI-like diluted share anomaly instead of multiplying the count by 1000',()=>{
  const e=deriveFinancingAutomation(company(),'2026-10-15');
  expect(e.shareCountWarning).toContain('13,600');
  expect(e.shareCountWarning).toContain('12,880,000');
  expect(e.weightedDilutedShares).toBeNull();
  const html=renderToStaticMarkup(createElement(SurvivalEvidencePanel,{company:company(),asOf:'2026-10-15'}));
  expect(html).toContain('Unreconciled');
  expect(html).toContain('Dilution proxy blocked');
  const q={ticker:'TEST',feed:'IEX',provider:'Alpaca',price:12,sessionDate:'2026-10-14',completedSession:true};
  const gate=assessConvictionReadiness(company(),q,'2026-10-15').requirements.find(x=>x.key==='survival');
  expect(gate?.detail).toContain('13,600');
  expect(gate?.status).toBe('missing');
 });
 it('never uses future-filed liquidity snapshots for a past as-of date',()=>{
  const c=company();
  c.metrics.find(x=>x.name==='Latest cash and cash equivalents')!.values=[filed(20000000,'2026-06-30','2026-10-16')];
  const e=deriveFinancingAutomation(c,'2026-10-15');
  expect(e.cash).toBeNull();
  expect(e.workingCapital).toBeNull();
  expect(e.cashToHistoricalBurnYears).toBeNull();
 });
 it('never mixes different balance sheet period ends or fabricates debt with missing tags',()=>{
  const c=company();
  c.metrics.find(x=>x.name==='Latest current liabilities')!.values=[filed(12000000,'2026-03-31','2026-05-08')];
  c.metrics.find(x=>x.name==='Latest noncurrent long-term debt')!.values=[];
  const e=deriveFinancingAutomation(c,'2026-10-15');
  expect(e.workingCapital).toBeNull();
  expect(e.currentRatio).toBeNull();
  expect(e.reportedDebtSubtotal).toBeNull();
  expect(e.debtFields).toBe(2);
 });
 it('refuses to present stale cash as current or as credible runway',()=>{
  const c=company();
  c.metrics.find(x=>x.name==='Latest cash and cash equivalents')!.values=[filed(10000000,'2025-12-31','2026-02-08')];
  const e=deriveFinancingAutomation(c,'2026-10-15');
  expect(e.status).toBe('historical_only');
  expect(e.cashToHistoricalBurnYears).toBeNull();
 });
 it('renders automatic observations without claiming a complete runway forecast',()=>{
  const html=renderToStaticMarkup(createElement(FinancingAutomationPanel,{company:company(),asOf:'2026-10-15'}));
  expect(html).toContain('Automatic cash runway');
  expect(html).toContain('Same-period working capital');
  expect(html).toContain('Historical cash / annual FCF burn');
  expect(html).toContain('NOT forecast runway');
  expect(html).toContain('SEC companyfacts');
 });
});
