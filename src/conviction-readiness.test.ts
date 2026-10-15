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
 it('labels unfinished ATLAS engines separately from source data not retrieved',()=>{
  const result=assessConvictionReadiness(sec(),close(),'2026-10-15');
  expect(result.requirements.find(x=>x.key==='market-cap')?.progress).toBe('engine_pending');
  expect(result.requirements.find(x=>x.key==='scenarios')?.progress).toBe('engine_pending');
  expect(result.requirements.find(x=>x.key==='ownership')?.progress).toBe('engine_pending');
  expect(result.requirements.find(x=>x.key==='monitoring')?.progress).toBe('partially_sourced');
  expect(result.requirements.find(x=>x.key==='cash-flow')?.progress).toBe('verified');
  expect(result.verifiedCount).toBe(4);
 });
 it('identifies rapidly growing negative-FCF optical suppliers as a financing question, not a buy signal',()=>{
  const data=sec();
  data.ticker='AAOI';
  data.metrics.find(x=>x.name==='Operating cash flow')!.values=[annual(2025,-250)];
  data.metrics.find(x=>x.name==='Capital expenditures')!.values=[annual(2025,103.576)];
  const cash=annual(2025,6.389);
  data.metrics.push({name:'Cash and cash equivalents',values:[cash]});
  const result=assessConvictionReadiness(data,{...close(),ticker:'AAOI'},'2026-10-15');
  expect(result.observed.freeCashFlow).toBeCloseTo(-353.576);
  expect(result.fundingRisk.status).toBe('growth_with_negative_fcf');
  expect(result.fundingRisk.headline).toContain('negative free cash flow');
  expect(result.requirements.find(x=>x.key==='survival')?.progress).toBe('partially_sourced');
  expect(result.requirements.find(x=>x.key==='survival')?.status).toBe('missing');
  expect(result.verdict).toBe('INSUFFICIENT EVIDENCE');
 });
 it('does not reclassify missing SEC cash-flow evidence as healthy funding',()=>{
  const data=sec();
  data.metrics.find(x=>x.name==='Operating cash flow')!.values=[];
  const result=assessConvictionReadiness(data,close(),'2026-10-15');
  expect(result.fundingRisk.status).toBe('unknown');
  expect(result.requirements.find(x=>x.key==='cash-flow')?.progress).toBe('source_unavailable');
 });
 it('automatically captures preliminary DEI/IEX capitalization but does not mark market cap verified',()=>{
  const data=sec();
  data.metrics.push({name:'Common shares outstanding (DEI)',values:[{year:2026,end:'2026-08-01',filed:'2026-08-08',form:'10-Q',accession:'0000123456-26-000001',value:12000000,tag:'EntityCommonStockSharesOutstanding'}]});
  const q={...close(),iex20:{sessionCount:20,startDate:'2026-09-16',endDate:'2026-10-14',avgDailyIexShares:35000,avgDailyIexDollarVolume:3500000,coverage:'IEX only'}};
  const result=assessConvictionReadiness(data,q,'2026-10-15');
  const cap=result.requirements.find(x=>x.key==='market-cap');
  expect(cap?.progress).toBe('partially_sourced');
  expect(cap?.detail).toContain('1,200,000,000');
  expect(cap?.status).toBe('missing');
  expect(result.verdict).toBe('INSUFFICIENT EVIDENCE');
  expect(result.verifiedCount).toBe(4);
 });
 it('reports no verified public sources when no issuer has been retrieved',()=>{
  const result=assessConvictionReadiness(null,null,'2026-10-15');
  expect(result.verifiedCount).toBe(0);
  expect(result.totalCount).toBeGreaterThanOrEqual(9);
 });
});
