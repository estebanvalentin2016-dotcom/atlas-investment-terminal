import {describe,expect,it} from 'vitest';
import {assessConvictionReadiness} from './conviction-readiness';
import type {MarketValuationClose,SecCompany} from './ranking-model';
const annual=(year:number,value:number)=>({year,end:year+'-12-31',filed:(year+1)+'-02-15',value,form:'10-K',accession:'0000000000-26-000101'});
const sec=():SecCompany=>({ticker:'TEST',name:'Test Industries',retrievedAt:'2026-10-15T12:00:00Z',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK1234567890.json',metrics:[
 {name:'Revenue',values:[annual(2025,150),annual(2024,100)]},
 {name:'Operating cash flow',values:[annual(2025,38)]},
 {name:'Capital expenditures',values:[annual(2025,8)]},
 {name:'Net income',values:[annual(2025,30)]},
 {name:'Diluted EPS',values:[annual(2025,5)]}
]});
const close=():MarketValuationClose=>({ticker:'TEST',price:100,sessionDate:'2026-10-14',feed:'IEX',provider:'Alpaca',completedSession:true,splitValidation:'unverified'});
describe('ATLAS conviction-readiness evidence gate',()=>{
 it('does not invent a Strong Buy from excellent fundamentals and a plausible annual P/E',()=>{
  const result=assessConvictionReadiness(sec(),close(),'2026-10-15');
  expect(result.verdict).toBe('INSUFFICIENT EVIDENCE');
  expect(result.observed.revenueGrowthPct).toBe(50);
  expect(result.observed.freeCashFlow).toBe(30);
  expect(result.observed.fyPe).toBe(20);
  expect(result.requirements.some(x=>x.key==='scenarios'&&x.status==='missing')).toBe(true);
  expect(result.requirements.some(x=>x.key==='survival'&&x.status==='missing')).toBe(true);
 });
 it('rejects future or stale prices as current valuation evidence',()=>{
  expect(assessConvictionReadiness(sec(),{...close(),sessionDate:'2026-10-20'},'2026-10-15').requirements.find(x=>x.key==='market-price')?.status).toBe('missing');
  expect(assessConvictionReadiness(sec(),{...close(),sessionDate:'2026-09-01'},'2026-10-15').requirements.find(x=>x.key==='market-price')?.status).toBe('missing');
 });
 it('does not treat negative profitability or missing EPS as an automatic rejection',()=>{
  const sample=sec();
  sample.metrics.find(x=>x.name==='Diluted EPS')!.values=[annual(2025,-3)];
  const result=assessConvictionReadiness(sample,close(),'2026-10-15');
  expect(result.observed.fyPe).toBeNull();
  expect(result.verdict).toBe('INSUFFICIENT EVIDENCE');
  expect(result.requirements.find(x=>x.key==='financial-history')?.status).toBe('verified');
 });
 it('treats missing or stale SEC financials as an evidence gap, not a positive score',()=>{
  const sample=sec();sample.metrics.forEach(m=>m.values.forEach(x=>{x.filed='2023-02-01'}));
  const result=assessConvictionReadiness(sample,close(),'2026-10-15');
  expect(result.requirements.find(x=>x.key==='financial-history')?.status).toBe('missing');
  expect(result.observed.revenueGrowthPct).toBeNull();
  expect(result.verdict).toBe('INSUFFICIENT EVIDENCE');
 });
 it('reports no verified public sources when no issuer has been retrieved',()=>{
  const result=assessConvictionReadiness(null,null,'2026-10-15');
  expect(result.verifiedCount).toBe(0);
  expect(result.totalCount).toBeGreaterThanOrEqual(9);
 });
});
