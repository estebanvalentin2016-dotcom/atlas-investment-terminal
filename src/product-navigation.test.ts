import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ResearchHome from './ResearchHome';
import ConvictionLab from './ConvictionLab';
import App from './App';
describe('Conviction-first navigation without deleting legacy capabilities',()=>{
 it('introduces the five connected stages and directs users to real research',()=>{
  const markup=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{}}));
  for(const step of ['Discover','Investigate','Value','Decide','Monitor'])expect(markup).toContain('>'+step+'</h3>');
  expect(markup).toContain('Open Conviction Lab');
  expect(markup).toContain('Find investment candidates');
 });
 it('starts the conviction investigation without manufacturing a live score',()=>{
  const markup=renderToStaticMarkup(createElement(ConvictionLab));
  expect(markup).toContain('Examine investment evidence');
  expect(markup).toContain('Insufficient Evidence');
  expect(markup).not.toContain('STRONG SPECULATIVE BUY</strong>');
 });
 it('puts demo components behind a distinct sandbox while preserving all historic routes',()=>{
  const markup=renderToStaticMarkup(createElement(App));
  expect(markup).toContain('Find asymmetric opportunities');
  expect(markup).toContain('YOUR RESEARCH JOURNEY');
  expect(markup).toContain('DEMO SANDBOX');
  expect(markup).toContain('Conviction Lab');
  expect(markup).toContain('Valuation Lab');
  expect(markup).toContain('Opportunity Radar');
  expect(markup).toContain('ATLAS workspace');
 });
});
