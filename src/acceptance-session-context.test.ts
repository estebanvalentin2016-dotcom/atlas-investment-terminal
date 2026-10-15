import {describe,it,expect} from 'vitest';
import {acceptanceSessionContext,type AcceptanceClock} from './acceptance-session-context';
import type {PriceBar} from './filing-price-context';
const bar=(date:string,open:number,close:number):PriceBar=>({date,open,close,high:Math.max(open,close),low:Math.min(open,close),volume:100});
const accepted=(date:string,time:string,window:AcceptanceClock['sessionWindow']):AcceptanceClock=>({acceptedEasternDate:date,acceptedEasternTime:time,acceptedEasternClock:date+' '+time+' ET',sessionWindow:window,provenance:'EDGAR header',firstPublicReleaseVerified:false});
const spy=[bar('2026-10-13',500,500),bar('2026-10-14',505,505),bar('2026-10-15',510,510)];
const stock=[bar('2026-10-13',100,100),bar('2026-10-14',105,110),bar('2026-10-15',115,120)];
describe('SEC acceptance to IEX completed-session alignment',()=>{
 it('uses the next session after a verified after-close SEC acceptance',()=>{
  const r=acceptanceSessionContext(stock,spy,accepted('2026-10-14','16:30:05','after_regular_close'));
  expect(r.status).toBe('aligned');
  expect(r.baseline).toEqual({date:'2026-10-14',close:110});
  expect(r.firstEligible?.date).toBe('2026-10-15');
  expect(r.firstEligible?.returnPct).toBeCloseTo(9.09);
  expect(r.firstEligible?.spyReturnPct).toBeCloseTo(.99);
  expect(r.following).toBeNull();
  expect(r.gapPct).toBeCloseTo(4.55);
  expect(r.regularSessionPct).toBeCloseTo(4.35);
 });
 it('does not show a first reaction before a post-close eligible day has completed',()=>{
  const r=acceptanceSessionContext(stock.slice(0,2),spy.slice(0,2),accepted('2026-10-14','16:30:05','after_regular_close'));
  expect(r.status).toBe('pending_completed_session');
  expect(r.baseline?.date).toBe('2026-10-14');
  expect(r.firstEligible).toBeNull();
 });
 it('uses the filing-date completed close when SEC accepted before market open',()=>{
  const r=acceptanceSessionContext(stock,spy,accepted('2026-10-14','08:40:00','before_regular_open'));
  expect(r.status).toBe('aligned');
  expect(r.baseline?.date).toBe('2026-10-13');
  expect(r.firstEligible?.date).toBe('2026-10-14');
  expect(r.firstEligible?.vsSpyPercentagePoints).toBe(9);
  expect(r.firstSessionMayIncludePriorTrading).toBe(false);
 });
 it('flags a during-session acceptance as including preacceptance price movement',()=>{
  const r=acceptanceSessionContext(stock,spy,accepted('2026-10-14','13:00:00','during_regular_session'));
  expect(r.firstEligible?.date).toBe('2026-10-14');
  expect(r.firstSessionMayIncludePriorTrading).toBe(true);
 });
 it('skips closed-market weekend when choosing first eligible completed session',()=>{
  const sample=[bar('2026-10-09',100,100),bar('2026-10-12',109,110)];
  const r=acceptanceSessionContext(sample,[],accepted('2026-10-10','12:00:00','during_regular_session'));
  expect(r.firstEligible?.date).toBe('2026-10-12');
  expect(r.baseline?.date).toBe('2026-10-09');
 });
 it('does not invent SPY when matching daily benchmark bars are absent',()=>{
  const r=acceptanceSessionContext(stock,[spy[0],spy[1]],accepted('2026-10-14','17:30:00','after_regular_close'));
  expect(r.firstEligible?.spyReturnPct).toBeNull();
  expect(r.firstEligible?.vsSpyPercentagePoints).toBeNull();
 });
 it('does not compare returns without a prior real completed session',()=>{
  const r=acceptanceSessionContext([stock[1]],spy,accepted('2026-10-14','10:00:00','during_regular_session'));
  expect(r.status).toBe('insufficient_history');
  expect(r.firstEligible).toBeNull();
 });
 it('uses the actual prior close even with out-of-order returned bars',()=>{
  const r=acceptanceSessionContext([stock[2],stock[0],stock[1]],spy,accepted('2026-10-14','16:00:00','after_regular_close'));
  expect(r.baseline?.date).toBe('2026-10-14');
  expect(r.firstEligible?.date).toBe('2026-10-15');
 });
});
