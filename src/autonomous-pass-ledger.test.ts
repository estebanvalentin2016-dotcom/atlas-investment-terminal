import {describe,expect,it} from 'vitest';
import {mergeSavedPasses,type SavedPreliminaryPass} from './autonomous-pass-ledger';
const pass=(ticker:string,observedAt:string,annualFiled='2026-02-15',preliminaryScore=60):SavedPreliminaryPass=>({ticker,observedAt,annualFiled,preliminaryScore});
describe('Autonomous financial pass crossover into recent SEC catalyst research',()=>{
 it('stores distinct ticker passes dated within the rolling research window',()=>{
  const r=mergeSavedPasses([pass('ALCOA','2026-09-01'),pass('STAL','2026-01-01')],[pass('ALCOA','2026-10-15'),pass('TEST','2026-10-10')],'2026-10-16');
  expect(r.map(x=>x.ticker)).toEqual(['ALCOA','TEST']);
  expect(r[0].observedAt).toBe('2026-10-15');
 });
 it('rejects late-filed annual data, future screening claims and malformed scores',()=>{
  const r=mergeSavedPasses([],[pass('NEXT','2026-10-17'),pass('FUT','2026-10-10','2026-10-15'),pass('BAD','2026-10-12','2026-02-15',Infinity),pass('TEST','2026-10-12')],'2026-10-16');
  expect(r.map(x=>x.ticker)).toEqual(['TEST']);
 });
 it('does not upgrade a historical provisional pass to a buy verdict',()=>{
  const r=mergeSavedPasses([],[pass('TEST','2026-10-15')],'2026-10-16');
  expect(Object.keys(r[0])).toEqual(['ticker','observedAt','annualFiled','preliminaryScore']);
 });
});
