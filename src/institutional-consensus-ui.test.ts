import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import InstitutionalConsensus from './InstitutionalConsensus';
import App from './App';
import {SecondaryNavigation} from './WorkspaceNavigation';
describe('Institutional consensus ATLAS UI',()=>{
 it('offers point-in-time SEC overlap analysis without manufacturing institutional approval',()=>{
  const html=renderToStaticMarkup(createElement(InstitutionalConsensus));
  expect(html).toContain('Analyze institutional overlap');
  expect(html).toContain('active-manager consensus');
  expect(html).toContain('source adapter pending');
  expect(html).toContain('Vanguard');
  expect(html).toContain('BlackRock / iShares');
  expect(html).toContain('State Street / SPDR');
  expect(html).not.toContain('Strong Speculative Buy');
 });
 it('keeps 8-K Opportunity Radar and Conviction Lab navigable when consensus is added',()=>{
  const html=renderToStaticMarkup(createElement(App))+renderToStaticMarkup(createElement(SecondaryNavigation,{page:'Autonomous Discovery',navigate:()=>{}}))+renderToStaticMarkup(createElement(SecondaryNavigation,{page:'Company Research',navigate:()=>{}}));
  expect(html).toContain('Institutional Consensus');
  expect(html).toContain('Institutional Discovery');
  expect(html).toContain('Opportunity Radar');
  expect(html).toContain('Conviction Lab');
 });
});
