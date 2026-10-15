import {describe,it,expect} from 'vitest';
import {financialAnalysis,type FinancialMetric} from './financial-analysis';
const metric=(name:string,values:{year:number;end:string;value:number}[]):FinancialMetric=>({name,unit:'USD',tag:'example',values:values.map(v=>({...v,filed:'2026-03-01'}))});
describe('financial insights',()=>{
 it('calculates YoY, three year CAGR, and margins from matched fiscal year ends',()=>{
 const metrics=[metric('Revenue',[{year:2026,end:'2026-01-31',value:480},{year:2025,end:'2025-01-31',value:400},{year:2024,end:'2024-01-31',value:320},{year:2023,end:'2023-01-31',value:240}]),metric('Net income',[{year:2026,end:'2026-01-31',value:-48}]),metric('Operating cash flow',[{year:2026,end:'2026-01-31',value:160}])];
 const r=financialAnalysis(metrics);
 expect(r[0].value).toBeCloseTo(20);
 expect(r[1].value).toBeCloseTo((Math.pow(2,1/3)-1)*100);
 expect(r[2].value).toBeCloseTo(-10);
 expect(r[3].value).toBeCloseTo(160/480*100);
 });
 it('returns N/A for missing years and mismatched periods',()=>{
 const r=financialAnalysis([metric('Revenue',[{year:2026,end:'2026-01-31',value:100}]),metric('Net income',[{year:2025,end:'2025-12-31',value:30}])]);
 expect(r.every(d=>d.value===null)).toBe(true);
 });
 it('refuses margin and growth calculations with zero denominators',()=>{
 const r=financialAnalysis([metric('Revenue',[{year:2026,end:'2026-01-31',value:0},{year:2025,end:'2025-01-31',value:100}]),metric('Net income',[{year:2026,end:'2026-01-31',value:12}])]);
 expect(r[0].value).toBeNull();expect(r[2].value).toBeNull();
 });
});
