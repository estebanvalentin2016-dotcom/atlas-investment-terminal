import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import FilingEvidence,{type FilingEvidenceResult} from './FilingEvidence';
import FilingPriceContext from './FilingPriceContext';

const sample:FilingEvidenceResult={
 url:'https://www.sec.gov/Archives/edgar/data/2012383/0001193125-26-420979.txt',
 sourceStatus:'partial_text',
 note:'Three selected SEC documents reviewed.',
 evidence:{
  status:'no_positive_phrase_detected',
  potential:[],cautions:[],
  metrics:[{label:'Reported revenue growth',reportedValue:'19% increase in revenue',
   excerpt:'19% increase in revenue year-over-year',
   sourceName:'blk-ex99_1.htm',
   sourceUrl:'https://www.sec.gov/Archives/edgar/data/2012383/000119312526420979/blk-ex99_1.htm'}],
  topics:[{code:'2.02',label:'Results of operations / earnings'}],
  textCharacters:2500,limitations:'Incomplete documents.'
 }
};
describe('Readable SEC research presentation',()=>{
 it('puts meaningful reported figures before collapsed technical details',()=>{
  const html=renderToStaticMarkup(createElement(FilingEvidence,{data:sample,loading:false,onReview:()=>{}}));
  expect(html).toContain('What stands out');
  expect(html).toContain('19% increase in revenue');
  expect(html.indexOf('19% increase in revenue')).toBeLessThan(html.indexOf('<details'));
  expect(html).toContain('Show the original passages behind the numbers');
  expect(html).toContain('Investment conclusion: NOT YET');
 });
 it('labels incomplete reviews without implying missing matches are bearish',()=>{
  const html=renderToStaticMarkup(createElement(FilingEvidence,{data:sample,loading:false,onReview:()=>{}}));
  expect(html).toContain('Incomplete source review');
  expect(html).toContain('not proof of no catalyst');
 });
 it('offers a large key-moves action without fetching data automatically',()=>{
  const html=renderToStaticMarkup(createElement(FilingPriceContext,{ticker:'BLK',eventDate:'2026-10-14',sourceUrl:sample.url}));
  expect(html).toContain('Show the key price moves');
  expect(html).not.toContain('Price movement at a glance');
 });
});
