describe('SEC DEI point-in-time common share counts',()=>{
 const item=(end:string,filed:string,val:number,form='10-Q')=>({end,filed,val,form,accn:'0000123456-26-000003'});
 it('accepts only dated, sourced instant share counts rather than weighted-average facts',()=>{
  const facts={dei:{EntityCommonStockSharesOutstanding:{units:{shares:[
   item('2026-08-01','2026-08-08',41000000),
   {...item('2026-08-01','2026-08-08',41000000)},
   {...item('2026-02-01','2026-02-08',39000000),'start':'2025-02-01'},
   item('2025-08-01','2025-08-08',35000000),
   item('2026-09-01','2026-08-08',60000000)
  ]}}}};
  const result=instantOutstandingShares(facts);
  expect(result.values.map((x:{value:number})=>x.value)).toEqual([41000000,35000000]);
  expect(result.quality).toBe('unreconciled_sec_entity_shares');
  expect(result.selectionNote).toContain('not verified');
 });
 it('does not invent missing or accessionless DEI counts',()=>{
  expect(instantOutstandingShares({}).values).toEqual([]);
  expect(instantOutstandingShares({dei:{EntityCommonStockSharesOutstanding:{units:{shares:[{...item('2026-08-01','2026-08-09',42000000),accn:undefined}]}}}}).values).toEqual([]);
 });
});
import {describe,expect,it} from 'vitest';
// @ts-ignore JavaScript-only SEC backend module is tested directly.
import {annualValues,selectFact,selectConsolidatedRevenue,instantOutstandingShares,latestInstantFact} from '../server/sec-api.mjs';
describe('SEC annual fact normalization',()=>{
 it('uses reported annual durations and latest filing for each fiscal ending year',()=>{
  const values=annualValues({units:{USD:[
   {form:'10-Q',fp:'Q1',start:'2025-01-01',end:'2025-03-31',filed:'2025-05-01',val:10,fy:2025},
   {form:'10-K',fp:'FY',start:'2024-01-01',end:'2024-12-31',filed:'2025-02-01',val:100,fy:2024},
   {form:'10-K',fp:'FY',start:'2024-01-01',end:'2024-12-31',filed:'2026-02-01',val:105,fy:2025},
  ]}});
  expect(values).toHaveLength(1);
  expect(values[0].value).toBe(105);
  expect(values[0].year).toBe(2024);
 });
 it('reads weighted-average diluted shares in the SEC shares unit, not dollars',()=>{
  const facts={'us-gaap':{WeightedAverageNumberOfDilutedSharesOutstanding:{units:{
   shares:[{form:'10-K',fp:'FY',start:'2025-01-01',end:'2025-12-31',filed:'2026-02-15',val:12500000}],
   USD:[{form:'10-K',fp:'FY',start:'2025-01-01',end:'2025-12-31',filed:'2026-02-15',val:50000000}]
  }}}};
  expect(selectFact(facts,['WeightedAverageNumberOfDilutedSharesOutstanding'],'shares').values[0].value).toBe(12500000);
  expect(selectFact(facts,['WeightedAverageNumberOfDilutedSharesOutstanding'],'shares').tag).toBe('WeightedAverageNumberOfDilutedSharesOutstanding');
 });
 it('keeps missing current and noncurrent debt tags absent instead of assuming zero',()=>{
  const facts={'us-gaap':{LongTermDebtCurrent:{units:{USD:[{form:'10-K',fp:'FY',end:'2025-12-31',filed:'2026-02-15',val:3000000}]}}}};
  expect(selectFact(facts,['LongTermDebtCurrent']).values[0].value).toBe(3000000);
  expect(selectFact(facts,['LongTermDebtNoncurrent']).values).toEqual([]);
  expect(selectFact(facts,['ShortTermBorrowings']).values).toEqual([]);
 });
 it('supports annual balance-sheet facts without start dates',()=>{
  const facts={'us-gaap':{Assets:{units:{USD:[{form:'10-K',fp:'FY',end:'2025-09-30',filed:'2025-11-01',val:500}]}}}};
  expect(selectFact(facts,['Assets']).values[0].value).toBe(500);
 });
 it('detects SBAC segment-revenue contamination from real 2025 SEC numbers',()=>{
  // SEC FY2025 10-K: total revenue $2,815,139,000 vs FY2024 $2,679,634,000;
  // site development revenue $244,498,000 vs $152,869,000. The old
  // leading tag selected site development and fabricated 59.9% growth.
  const fy=(year:number,value:number)=>({form:'10-K',fp:'FY',start:year+'-01-01',end:year+'-12-31',filed:(year+1)+'-02-27',val:value});
  const data={'us-gaap':{
    RevenueFromContractWithCustomerExcludingAssessedTax:{units:{USD:[fy(2025,244498000),fy(2024,152869000)]}},
    Revenues:{units:{USD:[fy(2025,2815139000),fy(2024,2679634000)]}}
  }};
  const result=selectConsolidatedRevenue(data);
  expect(result.tag).toBe('Revenues');
  expect(result.values.map((v:{year:number,value:number})=>[v.year,v.value])).toEqual([[2025,2815139000],[2024,2679634000]]);
  expect(result.quality).toBe('alternative_revenue_concepts');
  expect(result.alternativeTags).toContain('RevenueFromContractWithCustomerExcludingAssessedTax');
 });
 it('never uses a different smaller revenue concept to backfill a missing prior year',()=>{
  const fy=(year:number,value:number)=>({form:'10-K',fp:'FY',start:year+'-01-01',end:year+'-12-31',filed:(year+1)+'-02-27',val:value});
  const data={'us-gaap':{
    Revenues:{units:{USD:[fy(2025,500000000)]}},
    RevenueFromContractWithCustomerExcludingAssessedTax:{units:{USD:[fy(2024,100000000)]}}
  }};
  const result=selectConsolidatedRevenue(data);
  expect(result.tag).toBe('Revenues');
  expect(result.values).toHaveLength(1);
  expect(result.values[0].value).toBe(500000000);
 });
 it('returns empty data instead of inventing a missing metric',()=>{expect(selectFact({},['Revenue'])).toEqual({tag:null,values:[]})});
 it('accepts alternative consolidated-revenue tags',()=>{
  const facts={'us-gaap':{RevenueFromContractWithCustomerIncludingAssessedTax:{units:{USD:[
   {form:'10-K',fp:'FY',start:'2025-02-01',end:'2026-01-31',filed:'2026-03-05',val:4800000000}
  ]}}}};
  const r=selectFact(facts,['RevenueFromContractWithCustomerExcludingAssessedTax','RevenueFromContractWithCustomerIncludingAssessedTax']);
  expect(r.values[0].value).toBe(4800000000);
  expect(r.values[0].tag).toBe('RevenueFromContractWithCustomerIncludingAssessedTax');
 });
 it('fills missing years without double counting overlapping revenue concepts',()=>{
  const rec=(year:number,val:number)=>({form:'10-K',fp:'FY',start:`${year}-01-01`,end:`${year}-12-31`,filed:`${year+1}-02-15`,val});
  const facts={'us-gaap':{Revenues:{units:{USD:[rec(2025,200),rec(2024,150)]}},SalesRevenueNet:{units:{USD:[rec(2025,100),rec(2023,90)]}}}};
  const values=selectFact(facts,['Revenues','SalesRevenueNet']).values;
  expect(values.map((x:{year:number,value:number})=>[x.year,x.value])).toEqual([[2025,200],[2024,150],[2023,90]]);
 });

});
describe('Quarterly cash and borrowing observations, date provenance',()=>{
 const point=(end:string,filed:string,val:number,form='10-Q')=>({form,end,filed,val,accn:'0000123456-26-000099'});
 it('collects period-end instant balances across 10-Q and 10-K without treating periods as annual flows',()=>{
  const data={'us-gaap':{CashAndCashEquivalentsAtCarryingValue:{units:{USD:[
   point('2025-12-31','2026-02-15',8000000,'10-K'),
   point('2026-06-30','2026-08-08',10000000),
   {...point('2026-06-30','2026-08-08',90000000),start:'2026-04-01'},
   point('2026-09-30','2026-08-08',7000000)
  ]}}}};
  const result=latestInstantFact(data,['CashAndCashEquivalentsAtCarryingValue']);
  expect(result.values.map((v:{end:string;value:number})=>[v.end,v.value])).toEqual([['2026-06-30',10000000],['2025-12-31',8000000]]);
  expect(result.values[0].filed).toBe('2026-08-08');
 });
 it('returns missing rather than manufacturing values from unavailable GAAP tags',()=>{
  expect(latestInstantFact({},['LiabilitiesCurrent']).values).toEqual([]);
  expect(latestInstantFact({'us-gaap':{LongTermDebtCurrent:{units:{USD:[{...point('2026-06-30','2026-08-08',100000),accn:null}]}}}},['LongTermDebtCurrent']).values).toEqual([]);
 });
});
