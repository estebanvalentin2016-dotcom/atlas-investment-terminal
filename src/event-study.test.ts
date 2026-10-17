import {describe,it,expect} from 'vitest';
// @ts-ignore JavaScript-only research helper tested directly by Vitest.
import {easternClock,alignEvent,eventStudy,formatSecAcceptedEastern} from './event-study.mjs';
const dates=['2026-10-08','2026-10-09','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16'];
const bars=dates.map((date,i)=>({date,close:100+i*2}));
describe('event-to-session alignment',()=>{
 it('converts acceptance time to Eastern with daylight saving',()=>{
  expect(easternClock('2026-10-12T19:30:00Z')).toEqual({date:'2026-10-12',minute:930});
  expect(easternClock('2026-12-01T21:15:00Z')).toEqual({date:'2026-12-01',minute:975});
 });
 it('renders SEC acceptance consistently in Eastern time',()=>{
  expect(formatSecAcceptedEastern('2026-08-26T23:07:02Z')).toContain('EDT');
  expect(formatSecAcceptedEastern('2026-08-26T23:07:02Z')).toContain('7:07:02');
  expect(formatSecAcceptedEastern('2026-12-01T21:15:00Z')).toContain('EST');
  expect(formatSecAcceptedEastern(null)).toBe('Time unavailable');
 });
 it('uses the acceptance calendar date rather than a potentially different filing date',()=>{
  expect(easternClock('2026-04-21T01:53:18Z').date).toBe('2026-04-20');
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
 it('measures highest high and lowest low across completed sessions',()=>{
  const sample=[
   {date:'2026-10-09',close:100,high:101,low:99},
   {date:'2026-10-12',close:105,high:110,low:97},
   {date:'2026-10-13',close:103,high:108,low:95},
   {date:'2026-10-14',close:107,high:112,low:102}
  ];
  const result=eventStudy('2026-10-09T20:30:00Z',sample);
  expect(result.excursions.day1.highPct).toBeCloseTo(10);
  expect(result.excursions.day1.lowPct).toBeCloseTo(-3);
  expect(result.excursions.day3.highPct).toBeCloseTo(12);
  expect(result.excursions.day3.lowPct).toBeCloseTo(-5);
  expect(result.excursions.day5).toBeNull();
 });
 it('does not fabricate high-low ranges from closing-only data',()=>{
  const result=eventStudy('2026-10-12T20:10:00Z',bars);
  expect(result.excursions.day1).toBeNull();
  expect(result.returns.day1).not.toBeNull();
 });
 it('rejects invalid high-low bars rather than treating them as measured ranges',()=>{
  const sample=[{date:'2026-10-09',close:100,high:101,low:99},{date:'2026-10-12',close:102,high:99,low:104}];
  expect(eventStudy('2026-10-09T20:30:00Z',sample).excursions.day1).toBeNull();
 });
 it('measures post-first-close continuation as compound return, not added percentage points',()=>{
  const sample=[
   {date:'2026-08-26',close:100},
   {date:'2026-08-27',close:120.32},
   {date:'2026-08-28',close:121},
   {date:'2026-08-31',close:121.9},
   {date:'2026-09-01',close:115},
   {date:'2026-09-02',close:107.34}
  ];
  const r=eventStudy('2026-08-27T00:07:02Z',sample);
  expect(r.returns.day1).toBeCloseTo(20.32);
  expect(r.returns.day3).toBeCloseTo(21.9);
  expect(r.continuation.day3).toBeCloseTo((121.9/120.32-1)*100);
  expect(r.continuation.day5).toBeCloseTo((107.34/120.32-1)*100);
  expect(r.continuation.day5).toBeLessThan(0);
 });
 it('omits incomplete post-first-close horizons',()=>{
  const sample=[
   {date:'2026-10-09',close:100},
   {date:'2026-10-12',close:120},
   {date:'2026-10-13',close:123}
  ];
  const r=eventStudy('2026-10-09T20:30:00Z',sample);
  expect(r.continuation.day3).toBeNull();
  expect(r.continuation.day5).toBeNull();
 });
 it('separates overnight gap from open-to-close trading without adding percentages',()=>{
  const sample=[
   {date:'2026-08-26',close:100},
   {date:'2026-08-27',open:110,close:120,high:121,low:109},
   {date:'2026-08-28',close:121}
  ];
  const r=eventStudy('2026-08-27T00:07:02Z',sample);
  expect(r.firstSessionBreakdown.gapPct).toBeCloseTo(10);
  expect(r.firstSessionBreakdown.regularSessionPct).toBeCloseTo((120/110-1)*100);
  expect(r.returns.day1).toBeCloseTo(20);
  expect((1+r.firstSessionBreakdown.gapPct/100)*(1+r.firstSessionBreakdown.regularSessionPct/100)-1).toBeCloseTo(.2);
 });
 it('does not invent open-close or gap return when opening price is missing',()=>{
  const r=eventStudy('2026-10-12T20:10:00Z',bars);
  expect(r.firstSessionBreakdown.gapPct).toBeNull();
  expect(r.firstSessionBreakdown.regularSessionPct).toBeNull();
 });
 it('does not fabricate returns for insufficient data',()=>{
  expect(eventStudy('2026-10-16T22:00:00Z',bars).returns.day1).toBeNull();
 });
});
