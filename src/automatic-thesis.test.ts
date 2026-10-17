import {describe,expect,it} from 'vitest';
import {draftIssuerThesis} from './automatic-thesis';
import {assessPriceHistory} from './price-history-model';
import {assessConvictionReadiness} from './conviction-readiness';
import type {SecCompany,MarketValuationClose} from './ranking-model';
const annual=(year:number,value:number)=>({year,end:year+'-12-31',filed:(year+1)+'-02-01',form:'10-K',accession:'0000123456-26-000001',value});
const c=():SecCompany=>({ticker:'UNSEEN',name:'Unknown Industries',retrievedAt:'2026-10-15',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000123456.json',metrics:[
 {name:'Revenue',values:[annual(2025,150000000),annual(2024,100000000)]},
 {name:'Operating cash flow',values:[annual(2025,-3000000)]},
 {name:'Capital expenditures',values:[annual(2025,9000000)]},
 {name:'Net income',values:[annual(2025,-5000000)]},
 {name:'Diluted EPS',values:[annual(2025,-2)]},
 {name:'Latest cash and cash equivalents',values:[{year:2026,end:'2026-06-30',filed:'2026-08-01',form:'10-Q',accession:'0000123456-26-000003',value:10000000}]}
]});
const q:MarketValuationClose={ticker:'UNSEEN',price:12,sessionDate:'2026-10-14',feed:'IEX',provider:'Alpaca',completedSession:true};
describe('Autonomous Conviction Lab research draft',()=>{
 it('produces a dated issuer-specific thesis and invalidation checklist without inventing upside or buy recommendations',()=>{
  const issuer=c(),a=assessConvictionReadiness(issuer,q,'2026-10-15');
  const t=draftIssuerThesis(issuer,a,q,'2026-10-15');
  expect(t.thesis).toContain('UNSEEN');
  expect(t.thesis).toContain('2026-10-14');
  expect(t.thesis).toContain('50.0%');
  expect(t.thesis).toContain('-12,000,000');
  expect(t.thesis).toContain('2026-08-01');
  expect(t.invalidation).toContain('NOT active alerts');
  expect(t.invalidation).toContain('credit facilities');
  expect(t.thesis).toContain(issuer.source);
  expect(t.thesis).toContain('No source-backed fair value');
  expect(a.verdict).toBe('INSUFFICIENT EVIDENCE');
 });
 it('marks unavailable sources unknown rather than replacing with invented fundamentals',()=>{
  const issuer=c();
  issuer.metrics=issuer.metrics.filter(x=>x.name==='Revenue');
  const a=assessConvictionReadiness(issuer,null,'2026-10-15');
  const t=draftIssuerThesis(issuer,a,null,'2026-10-15');
  expect(t.thesis).toContain('after-capex FCF: unavailable');
  expect(t.thesis).toContain('stock close: unavailable');
  expect(t.note).toContain('not a verified investment thesis');
 });
 it('adds comparable historical stock-price weakness to the draft rather than mistaking growth for shareholder returns',()=>{
  const start=Date.UTC(2022,9,3),end=Date.UTC(2026,9,5);
  const bars=[];for(let t=start;t<=end;t+=7*86400000){
   const years=(t-start)/86400000/365.25;
   bars.push({date:new Date(t).toISOString().slice(0,10),close:100*Math.pow(0.90,years)});
  }
  const trend=assessPriceHistory({ticker:'UNSEEN',provider:'Alpaca',feed:'IEX',timeframe:'1Week',adjustment:'split',completedWeeksOnly:true,partialHistory:false,coverageStart:bars[0].date,coverageEnd:bars.at(-1)!.date,bars,note:'Weekly IEX close'},'2026-10-15');
  expect(trend.status).toBe('usable');
  expect(trend.returns.year1).toBeLessThan(0);
  const issuer=c(),a=assessConvictionReadiness(issuer,q,'2026-10-15');
  const draft=draftIssuerThesis(issuer,a,q,'2026-10-15',trend);
  expect(draft.thesis).toContain('SHAREHOLDER PRICE HISTORY');
  expect(draft.thesis).toContain('CROSS-PERIOD CONTRAST TO INVESTIGATE');
  expect(draft.thesis).toContain('These periods are not aligned');
  expect(draft.thesis).toContain('2025-12-31');
  expect(draft.thesis).toContain(trend.returnStartDates.year1!);
  expect(draft.thesis).toContain('revenue increased 50.0%');
  expect(draft.thesis).toContain('Not verified IPO-to-date');
  expect(draft.invalidation).toContain('split-adjusted 1Y/3Y');
  expect(draft.thesis).not.toContain('guaranteed');
 });
 it('withholds unverified historical trends and future-date quotes in generated text',()=>{
  const issuer=c(),future={...q,sessionDate:'2026-10-20'};
  const a=assessConvictionReadiness(issuer,future,'2026-10-15');
  const draft=draftIssuerThesis(issuer,a,future,'2026-10-15');
  expect(draft.thesis).toContain('stock close: unavailable');
  expect(draft.thesis).toContain('Comparable long-term split-adjusted stock-price history is unavailable');
  expect(draft.invalidation).toContain('unavailable / unavailable');
 });

});
