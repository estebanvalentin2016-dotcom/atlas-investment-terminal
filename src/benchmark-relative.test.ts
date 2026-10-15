import {describe,it,expect} from 'vitest';
// @ts-ignore JS module.
import {benchmarkRelative} from './benchmark-relative.mjs';
// @ts-ignore JS module.
import {eventStudy} from './event-study.mjs';
const dates=['2026-08-26','2026-08-27','2026-08-28','2026-08-31','2026-09-01','2026-09-02'];
const stock=dates.map((date,i)=>({date,close:[100,120,122,121,119,118][i]}));
const spy=dates.map((date,i)=>({date,close:[100,101,102,103,104,105][i]}));
const when='2026-08-27T00:07:02Z';
describe('benchmark-relative event measurement',()=>{
 it('subtracts SPY cumulative simple return in percentage points',()=>{
  const r=benchmarkRelative(when,stock,spy,eventStudy);
  expect(r.relative.day1).toBeCloseTo(19);
  expect(r.relative.day3).toBeCloseTo(21-3);
  expect(r.continuation.day5).toBeCloseTo(((118/120-1)-(105/101-1))*100);
 });
 it('does not substitute a nearby trading date when SPY is missing a session',()=>{
  const r=benchmarkRelative(when,stock,spy.filter(b=>b.date!=='2026-08-28'),eventStudy);
  expect(r.relative.day1).not.toBeNull();
  expect(r.relative.day3).toBeNull();
  expect(r.continuation.day5).toBeNull();
 });
 it('requires the exact benchmark reference session',()=>{
  const r=benchmarkRelative(when,stock,spy.slice(1),eventStudy);
  expect(r.relative.day1).toBeNull();
  expect(r.relative.day5).toBeNull();
  expect(r.continuation.day3).not.toBeNull();
 });
 it('never invents prices for an event beyond historical coverage',()=>{
  const r=benchmarkRelative('2026-09-02T21:00:00Z',stock,spy,eventStudy);
  expect(r.status).not.toBe('measured');
  expect(r.relative.day1).toBeNull();
 });
});
