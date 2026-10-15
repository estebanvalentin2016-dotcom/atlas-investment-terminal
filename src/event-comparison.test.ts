import {describe,it,expect} from 'vitest';
// @ts-ignore JavaScript-only event comparison helper.
import {comparableFilings} from './event-comparison.mjs';
describe('event comparison eligibility',()=>{
 const now=Date.parse('2026-10-15T06:00:00Z');
 it('selects newest three filings within supported historical range',()=>{
  const filings=[{acceptedAt:'2026-05-01T20:00:00Z'},{acceptedAt:'2026-08-26T20:00:00Z'},{acceptedAt:'2026-09-01T20:00:00Z'},{acceptedAt:'2026-06-03T20:00:00Z'}];
  expect(comparableFilings(filings,now).map((f:{acceptedAt:string})=>f.acceptedAt)).toEqual(['2026-09-01T20:00:00Z','2026-08-26T20:00:00Z','2026-06-03T20:00:00Z']);
 });
 it('rejects missing, ambiguous, future and old acceptance dates',()=>{
  const filings=[{acceptedAt:null},{acceptedAt:'2026-08-26T20:00:00'},{acceptedAt:'2025-01-01T00:00:00Z'},{acceptedAt:'2026-12-01T00:00:00Z'}];
  expect(comparableFilings(filings,now)).toEqual([]);
 });
});
