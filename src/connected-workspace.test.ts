import {afterEach,describe,it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import RealWorkspace from './RealWorkspace';
import DiscoveryIntelligence from './DiscoveryIntelligence';
import {fiveSessionRelative} from './topic-market';
import type {PriceBar} from './filing-price-context';
import {KEY as BRIEFING_KEY} from './discovery-briefing-storage';
const make=(d:string,price:number):PriceBar=>({date:d,open:price,high:price,low:price,close:price,volume:100});
function memory(initial:Record<string,string>={}):Storage {
 const entries=new Map(Object.entries(initial));
 return {get length(){return entries.size},clear(){entries.clear()},getItem:key=>entries.get(key)??null,key:index=>[...entries.keys()][index]??null,removeItem:key=>entries.delete(key),setItem:(key,value)=>entries.set(key,value)};
}
afterEach(()=>vi.unstubAllGlobals());
describe('Connected real-company and discovery workspaces',()=>{
 it('starts company research with source-backed lookup, not a fictional ticker detail',()=>{
  const html=renderToStaticMarkup(createElement(RealWorkspace,{mode:'research',defaultTicker:'BLK'}));
  expect(html).toContain('Does the investment evidence');
  expect(html).toContain('withstand investigation?');
  expect(html).toContain('Search SEC index');
  expect(html).toContain('Search resolves SEC issuer identity');
  expect(html).toContain('Choose an SEC-listed company to begin.');
  expect(html).not.toContain('atlas-discovery-briefing');
 });
 it('reduces a saved Discovery briefing to a compact research handoff',()=>{
  vi.stubGlobal('localStorage',memory({[BRIEFING_KEY]:JSON.stringify({version:1,scanCompletedAt:'2026-10-18T17:05:12.000Z',issuersExamined:24,leads:[{ticker:'TEST',companyName:'Test Company',preliminaryScreenStatus:'preliminary_pass',revenueGrowth:12,fcfMargin:9,annualPe:null,emergingStrength:'improving',screeningReasons:['Saved screening reason'],evidenceLimitations:['Primary source reconciliation remains incomplete.']}]})}));
  const html=renderToStaticMarkup(createElement(RealWorkspace,{mode:'research'}));
  expect(html).toContain('atlas-research-handoff');
  expect(html).toContain('Discovery handoff');
  expect(html).toContain('Test Company');
  expect(html).toContain('Investigate TEST');
  expect(html).toContain('Preliminary pass');
  expect(html).not.toContain('atlas-discovery-metrics');
  expect(html).not.toContain('Preliminary research briefing');
 });
  it('shows a real-company save and comparison interface before any stocks are added',()=>{
    const html=renderToStaticMarkup(createElement(RealWorkspace,{mode:'watchlist'}));
    expect(html).toContain('Saved companies');
    expect(html).toContain('Compare');
    expect(html).toContain('Your watchlist is empty');
  });
 it('offers on-demand keyword discovery and sector momentum without prefilled live news results',()=>{
  const html=renderToStaticMarkup(createElement(DiscoveryIntelligence));
  expect(html).toContain('Search topic news');
  expect(html).toContain('Compare sector and stock momentum');
  expect(html).not.toContain('Recent Google News coverage:');
 });
 it('compares five completed sessions with same-session SPY and no causal news score',()=>{
  const company=[10,11,12,13,14,15].map((p,i)=>make('2026-10-'+String(i+6).padStart(2,'0'),p));
  const spy=[100,101,102,103,104,105].map((p,i)=>make('2026-10-'+String(i+6).padStart(2,'0'),p));
  const result=fiveSessionRelative('TEST',company,spy);
  expect(result.return5).toBe(50);
  expect(result.spyReturn5).toBe(5);
  expect(result.relative5).toBe(45);
  expect(result.reason).toContain('not a prediction');
 });
 it('leaves relative momentum unknown without matching benchmark closes',()=>{
  const company=[10,11,12,13,14,15].map((p,i)=>make('2026-10-'+String(i+6).padStart(2,'0'),p));
  const r=fiveSessionRelative('TEST',company,[]);
  expect(r.return5).toBe(50);
  expect(r.relative5).toBeNull();
  expect(r.reason).toContain('SPY');
 });
});
