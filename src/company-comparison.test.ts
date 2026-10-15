import {describe,it,expect} from 'vitest';
import {comparisonRows} from './CompanyComparison';
import type {FinancialMetric} from './financial-analysis';
function metric(name:string,value:number,end='2026-01-31'):FinancialMetric{return {name,tag:'us-gaap',unit:'USD',values:[{year:2026,end,filed:'2026-03-05',value}]}}
const company=(ticker:string,metrics:FinancialMetric[])=>({ticker,name:ticker,source:'https://data.sec.gov',retrievedAt:'2026-10-14T12:00:00Z',metrics});
describe('comparison rows',()=>{
 it('keeps missing metrics unavailable',()=>{const rows=comparisonRows(company('A',[metric('Revenue',100)]),company('B',[]));expect(rows.find(r=>r.name==='Revenue')?.values[1]).toBeNull()});
 it('shows each company’s own fiscal year end',()=>{const rows=comparisonRows(company('A',[metric('Revenue',100,'2026-01-31')]),company('B',[metric('Revenue',300,'2026-07-31')]));const values=rows.find(r=>r.name==='Revenue')!.values;expect(values[0]?.end).toBe('2026-01-31');expect(values[1]?.end).toBe('2026-07-31')});
});
