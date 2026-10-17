import {describe,it,expect} from 'vitest';
import {filingPriceContext,type PriceBar} from './filing-price-context';
const day=(date:string,close:number):PriceBar=>({date,close,open:close,high:close,low:close,volume:100});
describe('SEC filing-date market context (NOT announcement attribution)',()=>{
 it('calculates baseline-to-filing and following-session returns with same-day SPY comparison',()=>{
  const bars=[day('2026-10-13',100),day('2026-10-14',110),day('2026-10-15',105)];
  const spy=[day('2026-10-13',500),day('2026-10-14',505),day('2026-10-15',510)];
  const r=filingPriceContext(bars,spy,'2026-10-14');
  expect(r.baseline).toEqual({date:'2026-10-13',close:100});
  expect(r.filingDay?.returnPct).toBe(10);
  expect(r.filingDay?.spyReturnPct).toBe(1);
  expect(r.filingDay?.vsSpyPercentagePoints).toBe(9);
  expect(r.followingSession?.returnPct).toBe(5);
  expect(r.followingSession?.spyReturnPct).toBe(2);
  expect(r.followingSession?.vsSpyPercentagePoints).toBe(3);
 });
 it('does not manufacture a following-session return from the event-day close',()=>{
  const r=filingPriceContext([day('2026-10-13',100),day('2026-10-14',110)],[], '2026-10-14');
  expect(r.filingDay?.returnPct).toBe(10);
  expect(r.followingSession).toBeNull();
  expect(r.lastCompletedInWindow?.date).toBe('2026-10-14');
  expect(r.hasFollowingSession).toBe(false);
 });
 it('uses real session dates rather than assuming weekends are trading days',()=>{
  const r=filingPriceContext([day('2026-10-09',100),day('2026-10-12',109),day('2026-10-13',111)],[], '2026-10-10');
  expect(r.baseline?.date).toBe('2026-10-09');
  expect(r.filingDay).toBeNull();
  expect(r.followingSession?.date).toBe('2026-10-12');
 });
 it('refuses any comparison without a preceding completed session',()=>{
  const r=filingPriceContext([day('2026-10-14',110)],[], '2026-10-14');
  expect(r.status).toBe('no_prior_close');
  expect(r.filingDay).toBeNull();
 });
 it('handles missing SPY bars without inventing benchmark relative performance',()=>{
  const r=filingPriceContext([day('2026-10-13',100),day('2026-10-14',110)],[day('2026-10-14',515)],'2026-10-14');
  expect(r.filingDay?.returnPct).toBe(10);
  expect(r.filingDay?.spyReturnPct).toBeNull();
  expect(r.filingDay?.vsSpyPercentagePoints).toBeNull();
 });
 it('rejects impossible filing calendar dates',()=>{
  expect(()=>filingPriceContext([],[],'2026-02-30')).toThrow('Invalid filing date');
 });
 it('never uses a future SPY session to fill an earlier comparison',()=>{
  const r=filingPriceContext([day('2026-10-13',100),day('2026-10-14',104)],[day('2026-10-13',500),day('2026-10-15',501)],'2026-10-14');
  expect(r.filingDay?.returnPct).toBe(4);
  expect(r.filingDay?.spyReturnPct).toBeNull();
 });
 it('orders out-of-order bars before choosing baseline and first following session',()=>{
  const r=filingPriceContext([day('2026-10-15',115),day('2026-10-13',100),day('2026-10-14',103)],[],'2026-10-14');
  expect(r.baseline?.date).toBe('2026-10-13');
  expect(r.followingSession?.date).toBe('2026-10-15');
 });
});
