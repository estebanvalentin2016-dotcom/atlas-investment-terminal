import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import InvestmentRankings from './InvestmentRankings';
describe('Real SEC research ranking UI',()=>{
 it('renders weight controls and requires manual fetch rather than fabricating stock picks',()=>{
  const html=renderToStaticMarkup(createElement(InvestmentRankings));
  expect(html).toContain('Revenue growth');
  expect(html).toContain('Free cash flow margin');
  expect(html).toContain('P/E valuation');
  expect(html).toContain('Rank these companies');
  expect(html).toContain('examples, not recommendations');
  expect(html).not.toContain('Research priority list');
 });
});
