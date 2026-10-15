import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {deriveOperatingScenarios} from './operating-scenarios';
import OperatingScenariosPanel from './OperatingScenariosPanel';
import {assessConvictionReadiness} from './conviction-readiness';
import type {SecCompany,MarketValuationClose} from './ranking-model';
const record=(year:number,value:number,filed=(year+1)+'-02-15')=>
 ({year,end:year+'-12-31',filed,value,form:'10-K',accession:'0000123456-26-000100'});
const company=():SecCompany=>({ticker:'TEST',name:'Test Co',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000123456.json',retrievedAt:'2026-10-15',metrics:[
 {name:'Revenue',tag:'Revenues',quality:'selected_standard_revenue_tag',values:[record(2025,150000000),record(2024,100000000)]},
 {name:'Operating cash flow',values:[record(2025,38000000)]},
 {name:'Capital expenditures',values:[record(2025,8000000)]},
 {name:'Diluted EPS',values:[record(2025,5)]}
]});
const quote:MarketValuationClose={ticker:'TEST',price:100,sessionDate:'2026-10-14',feed:'IEX',provider:'Alpaca',completedSession:true};
describe('Evidence-gated five-year operating sensitivities',()=>{
 it('uses actual source-dated SEC annual revenue, cash flow and capex to calculate a four-path operating table',()=>{
  const r=deriveOperatingScenarios(company(),'2026-10-15');
  expect(r.status).toBe('partial');
  expect(r.initialRevenue).toBe(150000000);
  expect(r.observedRevenueGrowthPct).toBe(50);
  expect(r.observedFcfMarginPct).toBe(20);
  expect(r.rows).toHaveLength(4);
  expect(r.rows.map(x=>x.name)).toEqual(['Bear','Base sensitivity','Bull','Remote moonshot']);
  expect(r.rows.every(x=>x.years.length===5)).toBe(true);
  for(const x of r.rows){expect(x.fy5Revenue).toBeCloseTo(150000000*Math.pow(1+x.annualRevenueGrowthPct/100,5));expect(x.fy5Fcf).toBeCloseTo(x.fy5Revenue*x.fy5FcfMarginPct/100)}
  expect(r.caution).toContain('NOT a forecast');
 });
 it('does not use a SEC filing that was not public at the research as-of date',()=>{
  const c=company();c.metrics.find(m=>m.name==='Revenue')!.values[0]=record(2025,150000000,'2026-10-16');
  expect(deriveOperatingScenarios(c,'2026-10-15').status).toBe('blocked');
  const c2=company();c2.metrics.find(m=>m.name==='Operating cash flow')!.values=[record(2025,38000000,'2026-10-16')];
  expect(deriveOperatingScenarios(c2,'2026-10-15').status).toBe('blocked');
 });
 it('blocks unsupported segment revenue concepts, stale and missing FCF evidence',()=>{
  const c=company();c.metrics.find(m=>m.name==='Revenue')!.quality='alternative_revenue_concepts';
  expect(deriveOperatingScenarios(c,'2026-10-15').status).toBe('blocked');
  expect(deriveOperatingScenarios(company(),'2028-10-15').status).toBe('blocked');
  const noCapex=company();noCapex.metrics.find(m=>m.name==='Capital expenditures')!.values=[];
  expect(deriveOperatingScenarios(noCapex,'2026-10-15').status).toBe('blocked');
 });
 it('blocks accounting outliers instead of projecting implausibly high free cash flow',()=>{
  const c=company();c.metrics.find(m=>m.name==='Operating cash flow')!.values=[record(2025,500000000)];
  const r=deriveOperatingScenarios(c,'2026-10-15');
  expect(r.status).toBe('blocked');
  expect(r.reasons.join(' ')).toContain('anomalous');
 });
 it('supports negative annual FCF without disguising financing risk as positive earnings',()=>{
  const c=company();c.metrics.find(m=>m.name==='Operating cash flow')!.values=[record(2025,-10000000)];
  const r=deriveOperatingScenarios(c,'2026-10-15');
  // Negative operating cash flow is a genuine SEC FY flow, not a missing balance.
  expect(r.status).toBe('partial');
  expect(r.observedFcfMarginPct).toBeLessThan(0);
  expect(r.rows.some(x=>x.fy5Fcf<0)).toBe(true);
 });
 it('withholds investment or target-price claims in the UI and readiness gate',()=>{
  const html=renderToStaticMarkup(createElement(OperatingScenariosPanel,{company:company(),asOf:'2026-10-15'}));
  expect(html).toContain('Five-year operating sensitivities');
  expect(html).toContain('Remote moonshot');
  expect(html).toContain('No five-year stock price');
  expect(html).toContain('SEC companyfacts');
  const readiness=assessConvictionReadiness(company(),quote,'2026-10-15');
  expect(readiness.requirements.find(x=>x.key==='scenarios')).toMatchObject({status:'missing',progress:'partially_sourced'});
  expect(readiness.verdict).toBe('INSUFFICIENT EVIDENCE');
  expect(readiness.verifiedCount).toBeLessThan(readiness.totalCount);
 });
});
