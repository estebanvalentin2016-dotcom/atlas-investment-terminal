import {describe,expect,it} from 'vitest';
// @ts-ignore JavaScript-only SEC backend module is tested directly.
import {annualValues,selectFact} from '../server/sec-api.mjs';
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
 it('supports annual balance-sheet facts without start dates',()=>{
  const facts={'us-gaap':{Assets:{units:{USD:[{form:'10-K',fp:'FY',end:'2025-09-30',filed:'2025-11-01',val:500}]}}}};
  expect(selectFact(facts,['Assets']).values[0].value).toBe(500);
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