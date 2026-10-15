import {describe,expect,it} from 'vitest';
import {draftIssuerThesis} from './automatic-thesis';
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
});
