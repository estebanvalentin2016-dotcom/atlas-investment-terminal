import {describe,it,expect} from 'vitest';
import {annualPeFromSec,type SecCompany,type MarketValuationClose} from './ranking-model';
// @ts-ignore Node-only free IEX valuation backend
import {mostRecentCompletedDaily} from '../server/market-api.mjs';
const c=():SecCompany=>({ticker:'ACME',name:'Acme',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK1.json',retrievedAt:'2026-10-15T00:00:00Z',metrics:[
 {name:'Revenue',values:[{year:2025,end:'2025-12-31',filed:'2026-02-15',value:100,form:'10-K',accession:'x'}]},
 {name:'Diluted EPS',values:[{year:2025,end:'2025-12-31',filed:'2026-02-15',value:5,form:'10-K',accession:'x'}]}
]});
const q=():MarketValuationClose=>({ticker:'ACME',price:100,sessionDate:'2026-10-14',feed:'IEX',provider:'Alpaca',completedSession:true,splitValidation:'unverified'});
describe('Automated SEC annual P/E valuation',()=>{
 it('computes indicative FY P/E from matching positive SEC EPS and completed IEX close',()=>{
  const r=annualPeFromSec(c(),q());
  expect(r.pe).toBe(20);
  expect(r.eps).toBe(5);
  expect(r.epsEnd).toBe('2025-12-31');
  expect(r.reason).toContain('fiscal-year P/E');
 });
 it('rejects EPS from an incompatible fiscal-period end',()=>{
  const x=c();
  x.metrics[1].values[0].end='2025-09-30';
  expect(annualPeFromSec(x,q()).pe).toBeNull();
 });
 it('rejects negative EPS instead of manufacturing a valuation multiple',()=>{
  const x=c();x.metrics[1].values[0].value=-3;
  expect(annualPeFromSec(x,q()).pe).toBeNull();
 });
 it('cannot use earnings that were published after the market-price session',()=>{
  const x=c();x.metrics[1].values[0].filed='2026-10-15';
  expect(annualPeFromSec(x,q()).pe).toBeNull();
 });
 it('does not treat unverified or missing stock price as a P/E value',()=>{
  expect(annualPeFromSec(c(),null).pe).toBeNull();
  const x=q();x.completedSession=false;
  expect(annualPeFromSec(c(),x).pe).toBeNull();
 });
 it('picks only recent completed sessions, never the current incomplete day',()=>{
  const result=mostRecentCompletedDaily([{date:'2026-10-14',close:15},{date:'2026-10-15',close:16}], '2026-10-15');
  expect(result.date).toBe('2026-10-14');
  expect(mostRecentCompletedDaily([{date:'2026-09-01',close:15}],'2026-10-15')).toBeNull();
 });
});
