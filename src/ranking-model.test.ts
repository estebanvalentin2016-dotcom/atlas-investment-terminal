import {describe,expect,it} from 'vitest';
import {toneForReportedMetric,toneForReturn} from './filing-metric-tone';
import {defaultRankWeights,deriveRankingMetrics,rankCompanies,scoreCompany,type SecCompany} from './ranking-model';
const annual=(year:number,value:number)=>({year,end:year+'-12-31',filed:(year+1)+'-02-15',form:'10-K',accession:'0000000000-26-000010',value});
const company=(ticker:string,includeCapex=true):SecCompany=>({ticker,name:ticker+' Inc',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0123456789.json',retrievedAt:'2026-10-15T12:00:00Z',metrics:[
 {name:'Revenue',values:[annual(2025,150),annual(2024,100)]},
 {name:'Net income',values:[annual(2025,30)]},
 {name:'Operating cash flow',values:[annual(2025,38)]},
 {name:'Capital expenditures',values:includeCapex?[annual(2025,8)]:[]}
]});
describe('Semantically colored report figures',()=>{
 it('shows true EPS/revenue increases as green +percent',()=>{
  expect(toneForReportedMetric('Reported EPS growth','25% increase in GAAP diluted EPS')).toEqual({tone:'positive',headline:'+25%',detail:'25% increase in GAAP diluted EPS'});
  expect(toneForReportedMetric('Reported revenue growth','19% increase in revenue').tone).toBe('positive');
 });
 it('shows declines as red and keeps ambiguous totals neutral',()=>{
  expect(toneForReportedMetric('Reported revenue growth','13% decrease in revenue')).toMatchObject({tone:'negative',headline:'−13%'});
  expect(toneForReportedMetric('Reported assets under management','$15.5 trillion in AUM').tone).toBe('neutral');
  expect(toneForReportedMetric('Reported cost growth','25% increase in operating costs').tone).toBe('neutral');
 });
 it('colors measured returns by sign without interpreting investment quality',()=>{
  expect(toneForReturn(1.75)).toBe('positive');
  expect(toneForReturn(-1.08)).toBe('negative');
  expect(toneForReturn(null)).toBe('neutral');
 });
});
describe('SEC annual fundamental ranking model',()=>{
 it('calculates cash flow AFTER actual capex with fiscal-year matching',()=>{
  const r=deriveRankingMetrics(company('TEST'));
  expect(r.year).toBe(2025);
  expect(r.fcf).toBe(30);
  expect(r.growth).toBe(50);
  expect(r.fcfMargin).toBe(20);
  expect(r.profitMargin).toBe(20);
 });
 it('never invents FCF when capex is absent',()=>{
  const r=deriveRankingMetrics(company('NOFCF',false));
  expect(r.fcf).toBeNull();
  expect(r.fcfMargin).toBeNull();
 });
 it('leaves missing P/E visibly missing and unable to earn valuation points',()=>{
  const a=scoreCompany(company('A'),defaultRankWeights);
  const b=scoreCompany(company('A'),defaultRankWeights,12);
  expect(a.metrics.pe).toBeNull();
  expect(a.missing).toContain('P/E (manual)');
  expect(a.coverage).toBe(85);
  expect(b.coverage).toBe(100);
  expect(b.score).toBeGreaterThan(a.score!);
 });
 it('refuses to rank a single-factor company regardless of high factor value',()=>{
  const data=company('ONE',false);
  data.metrics[1].values=[];
  const r=scoreCompany(data,defaultRankWeights);
  expect(r.score).toBeNull();
 });
 it('allows changing the ranking weights without treating missing factors as perfect',()=>{
  const sample=company('REAL');
  const a=scoreCompany(sample,{growth:0,fcf:100,profit:0,pe:0});
  const b=scoreCompany(sample,{growth:50,fcf:50,profit:0,pe:0});
  expect(a.score).toBeNull(); // need at least two independent verified SEC measures
  expect(b.score).not.toBeNull();
 });
 it('sorts only actual computed shortlist companies, not hidden hardcoded market picks',()=>{
  const high=company('HIGH');
  const low=company('LOW');
  low.metrics.find(m=>m.name==='Revenue')!.values=[annual(2025,80),annual(2024,100)];
  low.metrics.find(m=>m.name==='Net income')!.values=[annual(2025,-20)];
  low.metrics.find(m=>m.name==='Operating cash flow')!.values=[annual(2025,-5)];
  const ranks=rankCompanies([low,high],defaultRankWeights);
  expect(ranks.map(x=>x.ticker)).toEqual(['HIGH','LOW']);
  expect(ranks[0].score).toBeGreaterThan(ranks[1].score!);
 });
 it('rejects invented negative-capex accounting instead of boosting FCF',()=>{
  const sample=company('BAD');
  sample.metrics.find(m=>m.name==='Capital expenditures')!.values=[annual(2025,-100)];
  expect(deriveRankingMetrics(sample).fcf).toBeNull();
 });
});
