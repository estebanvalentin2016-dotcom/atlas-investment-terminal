import {describe,it,expect} from 'vitest';
// @ts-ignore Node-only market data adapter
import {normalizeBars,dailyMomentum,handleMarketRequest,iexCompletedLiquidity} from '../server/market-api.mjs';
describe('Alpaca daily market bars',()=>{
 it('sorts valid source bars by day',()=>{const bars=normalizeBars({bars:[{t:'2026-10-13T00:00:00Z',o:12,h:13,l:11,c:12,v:300},{t:'2026-10-12T00:00:00Z',o:10,h:11,l:9,c:10,v:100}]});expect(bars[0].close).toBe(10);expect(bars[1].volume).toBe(300)});
 it('rejects malformed market responses',()=>expect(()=>normalizeBars({bars:null})).toThrow());
 it('needs 21 days before displaying 20-session statistics',()=>expect(dailyMomentum([{close:5}])).toBeNull());
 it('calculates 1-, 3-, 5-day returns and whole-day RVOL',()=>{const bars=Array.from({length:21},(_,i)=>({date:'2026-10-'+String(i+1).padStart(2,'0'),open:10,high:i===20?15:12,low:9,close:i===20?15:10,volume:i===20?300:100}));const x=dailyMomentum(bars);expect(x.day1).toBeCloseTo(50);expect(x.day3).toBeCloseTo(50);expect(x.day5).toBeCloseTo(50);expect(x.rvol).toBeCloseTo(3);expect(x.below20DayHighPct).toBeCloseTo(0)});
 it('does not intercept unrelated routes',async()=>expect(await handleMarketRequest({url:'/api/sec/company'},{})).toBe(false));
});

describe('Completed IEX-only liquidity evidence',()=>{
 const bars=Array.from({length:20},(_,i)=>({date:'2026-09-'+String(i+1).padStart(2,'0'),close:10,volume:1000,open:10,high:11,low:9}));
 it('computes 20 completed sessions of observed shares and turnover',()=>{
  const result=iexCompletedLiquidity([...bars,{...bars[0],date:'2026-10-15',volume:9999999}], '2026-10-15');
  expect(result).toMatchObject({sessionCount:20,avgDailyIexShares:1000,avgDailyIexDollarVolume:10000,startDate:'2026-09-01',endDate:'2026-09-20'});
  expect(result.coverage).toContain('not consolidated');
 });
 it('refuses incomplete or duplicate trading-session windows',()=>{
  expect(iexCompletedLiquidity(bars.slice(0,19),'2026-10-15')).toBeNull();
  expect(iexCompletedLiquidity([...bars.slice(0,19),bars[0]],'2026-10-15')).toBeNull();
 });
});
