import {describe,it,expect} from 'vitest';
// @ts-ignore JavaScript-only research helper tested directly by Vitest.
import {easternClock,alignEvent,eventStudy} from './event-study.mjs';
const dates=['2026-10-08','2026-10-09','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16'];
const bars=dates.map((date,i)=>({date,close:100+i*2}));
describe('event-to-session alignment',()=>{
 it('converts acceptance time to Eastern with daylight saving',()=>{
  expect(easternClock('2026-10-12T19:30:00Z')).toEqual({date:'2026-10-12',minute:930});
  expect(easternClock('2026-12-01T21:15:00Z')).toEqual({date:'2026-12-01',minute:975});
 });
 it('rejects date-only timestamps rather than guessing an announcement time',()=>{
  expect(easternClock('2026-10-12')).toBeNull();
  expect(alignEvent(undefined,bars).status).toBe('timestamp-unavailable');
 });
 it('aligns premarket to same day and after-close to next session',()=>{
  expect(alignEvent('2026-10-12T12:30:00Z',bars).firstSession).toBe('2026-10-12');
  expect(alignEvent('2026-10-12T20:00:00Z',bars).firstSession).toBe('2026-10-13');
 });
 it('skips non-trading days using the provided actual sessions',()=>{
  expect(alignEvent('2026-10-10T12:00:00Z',bars).firstSession).toBe('2026-10-12');
 });
 it('requires a pre-event reference close',()=>{
  expect(alignEvent('2026-10-08T12:00:00Z',bars).status).toBe('insufficient-history');
 });
 it('measures returns from previous close without using future information as inputs',()=>{
  const result=eventStudy('2026-10-12T20:10:00Z',bars);
  expect(result.baselineSession).toBe('2026-10-12');
  expect(result.firstSession).toBe('2026-10-13');
  expect(result.returns.day1).toBeCloseTo((106/104-1)*100);
  expect(result.returns.day3).toBeCloseTo((110/104-1)*100);
  expect(result.returns.day5).toBeNull();
 });
 it('does not fabricate returns for insufficient data',()=>{
  expect(eventStudy('2026-10-16T22:00:00Z',bars).returns.day1).toBeNull();
 });
});
