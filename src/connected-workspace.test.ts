import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import RealWorkspace from './RealWorkspace';
import DiscoveryIntelligence from './DiscoveryIntelligence';
import {fiveSessionRelative} from './topic-market';
import type {PriceBar} from './filing-price-context';
const make=(d:string,price:number):PriceBar=>({date:d,open:price,high:price,low:price,close:price,volume:100});
describe('Connected real-company and discovery workspaces',()=>{
 it('starts company research with source-backed lookup, not a fictional ticker detail',()=>{
  const html=renderToStaticMarkup(createElement(RealWorkspace,{mode:'research',defaultTicker:'BLK'}));
  expect(html).toContain('Search and investigate any SEC-listed company');
  expect(html).toContain('Search companies');
  expect(html).toContain('Real SEC facts');
 });
 it('shows a real-company save and comparison interface before any stocks are added',()=>{
  const html=renderToStaticMarkup(createElement(RealWorkspace,{mode:'watchlist'}));
  expect(html).toContain('Saved companies');
  expect(html).toContain('Compare');
  expect(html).toContain('No real companies saved yet');
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
