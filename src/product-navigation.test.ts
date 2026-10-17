import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ResearchHome from './ResearchHome';
import ConvictionLab from './ConvictionLab';
import App from './App';
import WorkspaceMethodology from './WorkspaceMethodology';
import {PrimaryNavigation,SecondaryNavigation} from './WorkspaceNavigation';
import {workspaces,workspaceFor,type Page} from './workspace-navigation';
describe('Conviction-first navigation without deleting legacy capabilities',()=>{
 it('introduces the five connected stages and directs users to real research',()=>{
  const markup=renderToStaticMarkup(createElement(WorkspaceMethodology))+renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{}}));
  for(const step of ['Discover','Investigate','Value','Decide','Monitor'])expect(markup).toContain('>'+step+'</h3>');
  expect(workspaceFor('Conviction Lab').name).toBe('Research');
  expect(markup).toContain('Discover Opportunities');
 });
 it('starts the conviction investigation without manufacturing a live score',()=>{
  const markup=renderToStaticMarkup(createElement(ConvictionLab));
  expect(markup).toContain('Examine investment evidence');
  expect(markup).toContain('Insufficient Evidence');
  expect(markup).not.toContain('STRONG SPECULATIVE BUY</strong>');
 });
 it('puts demo components behind a distinct sandbox while preserving all historic routes',()=>{
  const markup=renderToStaticMarkup(createElement(App));
  expect(markup).toContain('Your research, prioritized');
  expect(workspaces.map(group=>group.name)).toEqual(['Home','Discover','Research','Watchlist','Settings / Tools']);
  const demo=renderToStaticMarkup(createElement(SecondaryNavigation,{page:'Methodology',navigate:()=>{}}));
  expect(demo).toContain('Demo Sandbox · fictional data');
  expect(demo).toContain('Demo Valuation Lab');
  expect(markup).toContain('ATLAS workspace');
 });
 it('keeps all historic destinations in exactly one workspace',()=>{
  const historic:Page[]=['Research Home','Autonomous Discovery','Conviction Lab','Institutional Discovery','Institutional Consensus','Overview','Screener','Company Research','Valuation Lab','Watchlist','SEC Research','Breakthrough Radar','Discovery Feed','Catalyst Radar','Opportunity Radar','Daily Momentum','Momentum Scanner'];
  for(const page of historic){
   expect(workspaces.filter(group=>(group.pages as readonly string[]).includes(page))).toHaveLength(1);
   const group=workspaceFor(page);
   const primary=renderToStaticMarkup(createElement(PrimaryNavigation,{page,navigate:()=>{}}));
   expect((primary.match(/class="navitem /g)||[])).toHaveLength(5);
   if(group.pages.length>1){const secondary=renderToStaticMarkup(createElement(SecondaryNavigation,{page,navigate:()=>{}}));expect(secondary).toContain('aria-current="page"');}
  }
 });
});
