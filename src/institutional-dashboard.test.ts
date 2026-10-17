import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import InstitutionalDiscovery from './InstitutionalDiscovery';
import App from './App';
import {SecondaryNavigation} from './WorkspaceNavigation';
describe('13F Smart Money Discovery UI',()=>{
 it('offers investor and company search without inventing institutional ownership',()=>{
  const markup=renderToStaticMarkup(createElement(InstitutionalDiscovery));
  expect(markup).toContain('Investor → Companies');
  expect(markup).toContain('Company → Investors');
  expect(markup).toContain('Load manager 13F');
  expect(markup).toContain('Quarter-end snapshots');
  expect(markup).not.toContain('Newly reported</span>');
 });
 it('keeps the SEC Opportunity Radar accessible while adding institutional discovery',()=>{
  const markup=renderToStaticMarkup(createElement(App))+renderToStaticMarkup(createElement(SecondaryNavigation,{page:'Autonomous Discovery',navigate:()=>{}}))+renderToStaticMarkup(createElement(SecondaryNavigation,{page:'Company Research',navigate:()=>{}}));
  expect(markup).toContain('Institutional Discovery');
  expect(markup).toContain('Opportunity Radar');
  expect(markup).toContain('Conviction Lab');
  expect(markup).toContain('Home');
 });
});
