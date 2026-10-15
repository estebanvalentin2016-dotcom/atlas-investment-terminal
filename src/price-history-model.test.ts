import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {assessPriceHistory,combineResearchPriority,trailingPriceWindow,type HistoricalPriceResponse} from './price-history-model';
import PriceHistoryPanel from './PriceHistoryPanel';

const asOf='2026-10-15';
const fixture=(annualFactor=1.08):HistoricalPriceResponse=>{
 const start=Date.UTC(2016,9,3);
 const end=Date.UTC(2026,9,5);
 const bars=[];
 for(let t=start;t<=end;t+=7*86400000){
  const years=(t-start)/86400000/365.25;
  bars.push({date:new Date(t).toISOString().slice(0,10),close:Number((30*Math.pow(annualFactor,years)).toFixed(4))});
 }
 return {ticker:'AEYE',provider:'Alpaca',feed:'IEX',timeframe:'1Week',adjustment:'split',completedWeeksOnly:true,
  partialHistory:false,coverageStart:bars[0].date,coverageEnd:bars.at(-1)!.date,bars,
  note:'Split-adjusted weekly IEX; not verified IPO'};
};
describe('Long-horizon historical stock-price evidence',()=>{
 it('shows correct completed split-adjusted 1Y, 3Y, 5Y and available return horizons',()=>{
  const a=assessPriceHistory(fixture(),'2026-10-15');
  expect(a.status).toBe('usable');
  expect(a.returns.year1).toBeGreaterThan(0);
  expect(a.returns.year3).toBeGreaterThan(a.returns.year1!);
  expect(a.returns.year5).toBeGreaterThan(a.returns.year3!);
  expect(a.returns.sinceAvailable).toBeGreaterThan(100);
  expect(a.coverageNote).toContain('not the verified IPO');
  expect(a.trendScore).not.toBeNull();
 });
 it('computes the 5Y metric from the exact first weekly bar displayed on the 5Y chart',()=>{
  const data=fixture(1);
  const latest=data.bars.at(-1)!;
  const target=new Date(latest.date+'T00:00:00Z');
  target.setUTCFullYear(target.getUTCFullYear()-5);
  const anniversary=target.toISOString().slice(0,10);
  const before=data.bars.filter(b=>b.date<anniversary).at(-1);
  const firstAfter=data.bars.find(b=>b.date>=anniversary)!;
  expect(before).toBeDefined();
  before!.close=12;
  firstAfter.close=36;
  latest.close=60;
  const window=trailingPriceWindow(data.bars,asOf,5)!;
  const result=assessPriceHistory(data,asOf);
  expect(window[0].date).toBe(firstAfter.date);
  expect(result.returnStartDates.year5).toBe(firstAfter.date);
  expect(result.returns.year5).toBeCloseTo(Math.round((latest.close/firstAfter.close-1)*10000)/100,2);
  expect(result.returns.year5).not.toBeCloseTo(Math.round((latest.close/before!.close-1)*10000)/100,1);
  const html=renderToStaticMarkup(createElement(PriceHistoryPanel,{ticker:'AEYE',history:data,asOf}));
  expect(html).toContain('from '+firstAfter.date+' to '+latest.date);
  expect(html).toContain('+66.7% in selected window');
  expect(html).toContain('5-year price change');
 });
 it('rejects sparse weekly endpoints as a credible full-period price return',()=>{
  const old=fixture(1);
  const sparse={...old,bars:[old.bars[0],old.bars[100],old.bars[200],old.bars.at(-1)!]};
  const e=assessPriceHistory(sparse,asOf);
  expect(e.returns.year1).toBeNull();
  expect(e.returns.year3).toBeNull();
  expect(e.returns.year5).toBeNull();
  expect(e.trendScore).toBeNull();
  expect(trailingPriceWindow(sparse.bars,asOf,5)).toBeNull();
  expect(combineResearchPriority(75,e)).toEqual({score:75,priceWeighted:false});
 });
 it('exposes a long-duration flat price despite positive fundamental returns',()=>{
  const trend=assessPriceHistory(fixture(1),asOf);
  expect(trend.returns.sinceAvailable).toBe(0);
  expect(trend.returns.year5).toBe(0);
  expect(trend.returns.year1).toBe(0);
  expect(trend.assessment).toBe('Mixed long-term price trend');
  expect(combineResearchPriority(90,trend)).toEqual({score:82,priceWeighted:true});
 });
 it('penalizes falling historical prices in research prioritization without issuing investment advice',()=>{
  const up=assessPriceHistory(fixture(1.2),asOf);
  const down=assessPriceHistory(fixture(0.85),asOf);
  expect(down.returns.year3).toBeLessThan(0);
  expect(combineResearchPriority(80,up).score).toBeGreaterThan(combineResearchPriority(80,down).score!);
 });
 it('never rewards unavailable, incomplete, stale, or future-only history',()=>{
  const partial=assessPriceHistory({...fixture(),partialHistory:true},asOf);
  const stale=assessPriceHistory(fixture(),'2027-03-01');
  const wrong=assessPriceHistory({...fixture(),adjustment:'raw'},asOf);
  expect(partial.trendScore).toBeNull();
  expect(stale.status).toBe('stale');
  expect(wrong.status).toBe('missing');
  expect(combineResearchPriority(70,partial)).toEqual({score:70,priceWeighted:false});
  expect(combineResearchPriority(null,assessPriceHistory(fixture(),asOf))).toEqual({score:null,priceWeighted:false});
 });
 it('renders a selectable price chart and source-labeled returns',()=>{
  const h=fixture(1);
  const markup=renderToStaticMarkup(createElement(PriceHistoryPanel,{ticker:'AEYE',history:h,asOf}));
  expect(markup).toContain('Historical share-price performance');
  expect(markup).toContain('Historical price window');
  expect(markup).toContain('aria-label="Split-adjusted IEX weekly closing prices');
  expect(markup).toContain('5-year price change');
  expect(markup).toContain('Not verified IPO-to-date return');
  expect(markup).toContain('0.0%');
 });
});
