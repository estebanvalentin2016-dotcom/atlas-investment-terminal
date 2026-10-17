import {describe,expect,it} from 'vitest';
import {calculateConditionalOutcomes} from './conditional-outcomes';
import type {HistoricalPriceResponse} from './price-history-model';
const asOf='2026-10-15';
function historical(annualFactor=1.10):HistoricalPriceResponse{
 const start=Date.UTC(2019,9,7),end=Date.UTC(2026,9,5),bars=[];
 for(let t=start;t<=end;t+=7*86400000){const years=(t-start)/86400000/365.25;bars.push({date:new Date(t).toISOString().slice(0,10),close:Math.round(5000*Math.pow(annualFactor,years))/100})}
 return {ticker:'TEST',provider:'Alpaca',feed:'IEX',adjustment:'split',timeframe:'1Week',completedWeeksOnly:true,
  partialHistory:false,coverageStart:bars[0].date,coverageEnd:bars.at(-1)!.date,bars,note:'Test observations'};
}
describe('Transparent history-based conditional dollar scenarios',()=>{
 it('starts at $500 and scales gains and loss stress precisely with amount',()=>{
  const r=calculateConditionalOutcomes(historical(),500,3,asOf,'2026-10-14');
  expect(r.status).toBe('available');
  expect(r.sampleCount).toBeGreaterThan(30);
  expect(r.bands).toHaveLength(3);
  for(const b of r.bands){expect(b.endingValue).toBeCloseTo(500+b.profit,1)}
  expect(r.severeStress).toEqual({returnPct:-50,endingValue:250,profit:-250});
  const double=calculateConditionalOutcomes(historical(),1000,3,asOf,'2026-10-14');
  expect(double.bands[1].endingValue).toBeCloseTo(r.bands[1].endingValue*2,1);
  expect(double.severeStress).toEqual({returnPct:-50,endingValue:500,profit:-500});
  expect(r.reason).toContain('NOT calibrated forecasts');
  expect(r.reason).toContain('NOT calibrated forecasts');
 });
 it('illustrates downward historical moves instead of assuming every event is profitable',()=>{
  const r=calculateConditionalOutcomes(historical(0.82),500,6,asOf,'2026-10-14');
  expect(r.status).toBe('available');
  expect(r.bands.some(b=>b.profit<0)).toBe(true);
  expect(r.bands[0].endingValue).toBeLessThan(500);
 });
 it('offers different empirical observations for one, three, six and twelve months',()=>{
  for(const m of [1,3,6,12] as const){
   const r=calculateConditionalOutcomes(historical(),500,m,asOf,'2026-10-14');
   expect(r.status).toBe('available');
   expect(r.horizonMonths).toBe(m);
  }
  const one=calculateConditionalOutcomes(historical(),500,1,asOf,'2026-10-14');
  const twelve=calculateConditionalOutcomes(historical(),500,12,asOf,'2026-10-14');
  expect(twelve.bands[1].endingValue).toBeGreaterThan(one.bands[1].endingValue);
 });
 it('withholds numbers for stale quotes, future prices, source gaps and partial history',()=>{
  expect(calculateConditionalOutcomes(historical(),500,3,asOf,'2026-09-01').status).toBe('unavailable');
  expect(calculateConditionalOutcomes(historical(),500,3,asOf,'2026-10-20').status).toBe('unavailable');
  expect(calculateConditionalOutcomes({...historical(),partialHistory:true},500,3,asOf,'2026-10-14').status).toBe('unavailable');
  const sparse={...historical(),bars:historical().bars.filter((_,i)=>i%6===0)};
  expect(calculateConditionalOutcomes(sparse,500,3,asOf,'2026-10-14').status).toBe('unavailable');
 });
 it('refuses invalid dollar amounts and unknown market data',()=>{
  expect(calculateConditionalOutcomes(null,500,3,asOf,'2026-10-14').status).toBe('unavailable');
  expect(calculateConditionalOutcomes(historical(),-500,3,asOf,'2026-10-14').status).toBe('unavailable');
  expect(calculateConditionalOutcomes(historical(),Infinity,3,asOf,'2026-10-14').status).toBe('unavailable');
 });
});
