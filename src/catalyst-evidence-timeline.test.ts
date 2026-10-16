import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {assessCatalystEvidenceTimeline} from './catalyst-evidence-timeline';
import CatalystVerificationPanel from './CatalystVerificationPanel';
import type {FilingEvidenceResult} from './FilingEvidence';
import type {CandidateHeadline} from './catalyst-fundamental-bridge';
const url='https://www.sec.gov/Archives/edgar/data/1234567/0001234567-26-000001.txt';
const filing=():FilingEvidenceResult=>({url,sourceStatus:'partial_text',reviewMethod:'selected_documents',note:'Primary and exhibit selected only',
 selection:{primaryLocated:true,exhibitsListed:1,selectedExhibits:1},
 documents:[{role:'Primary 8-K',name:'primary.htm',url,status:'reviewed'}],
 evidence:{status:'no_positive_phrase_detected',potential:[],cautions:[],metrics:[{label:'Reported revenue growth',reportedValue:'19% increase in revenue',excerpt:'19% increase in revenue',sourceUrl:url}],
 topics:[{code:'2.02',label:'Results of operations / earnings'},{code:'9.01',label:'Financial statements / exhibits'}],textCharacters:100,limitations:'selected docs'}
});
const news=(day:string,title='Albertsons pulls full-year guidance'):CandidateHeadline=>({title,source:'Example RSS',link:'https://news.google.com/rss/articles/example',feedPublishedAt:day+'T15:00:00Z',feedDateOnly:null});
describe('SEC catalyst chronology and selective-source materiality checks',()=>{
 it('highlights Albertsons-like news dates preceding 8-K without attributing later stock returns',()=>{
  const r=assessCatalystEvidenceTimeline({filingDate:'2026-10-15',asOf:'2026-10-16',issuerName:'Alcoa Corp',review:filing(),headlines:[news('2026-10-13'),news('2026-10-15'),news('2026-10-16')]});
  expect(r.subject).toBe('earnings_disclosure');
  expect(r.subjectLabel).toContain('Item 2.02');
  expect(r.recognizedMetrics[0].reportedValue).toBe('19% increase in revenue');
  expect([r.before,r.sameDate,r.after]).toEqual([1,1,1]);
  expect(r.earliestHeadlineDate).toBe('2026-10-13');
  expect(r.sameSubjectHeadlines).toBe(0); // Albertsons-guidance title is not a matching Alcoa earnings story
  expect(r.warnings).toContain('news_predates_filing');
  expect(r.notes.join(' ')).toContain('may already have been public or priced');
  expect(r.notes.join(' ')).toContain('NOT been verified');
 });
 it('aligns earnings-report subject and issuer-matched headlines without mistaking them for bullish corroboration',()=>{
  const r=assessCatalystEvidenceTimeline({filingDate:'2026-10-15',asOf:'2026-10-16',issuerName:'Alcoa Corp',review:filing(),headlines:[
    news('2026-10-15','Alcoa Corporation Reports Third Quarter 2026 Results'),
    news('2026-10-16','Alcoa Earnings: Down on Weaker Shipments'),
    news('2026-10-16','American Airlines Q3 Earnings announced')
  ]});
  expect(r.sameSubjectHeadlines).toBe(2);
  expect(r.preFilingSameSubjectHeadlines).toBe(0);
  expect(r.notes.join(' ')).toContain('NOT verified same-event corroboration');
 });
 it('does not use future news in timeline and keeps bad timestamps uncertain',()=>{
  const r=assessCatalystEvidenceTimeline({filingDate:'2026-10-15',asOf:'2026-10-16',issuerName:'Alcoa Corp',review:filing(),headlines:[
   news('2026-10-17'),{...news('2026-10-15'),feedPublishedAt:null,feedDateOnly:'2026-10-15'}, {...news('2026-10-15'),feedPublishedAt:null,feedDateOnly:null}
  ]});
  expect([r.before,r.sameDate,r.after,r.undated,r.future]).toEqual([0,1,0,1,1]);
  expect(r.warnings).toContain('source_timing_unknown');
  expect(r.earliestHeadlineDate).toBe('2026-10-15');
 });
 it('does not infer materiality or a positive catalyst from an SEC item or upward financial metric',()=>{
  const r=assessCatalystEvidenceTimeline({filingDate:'2026-10-15',asOf:'2026-10-16',issuerName:'Alcoa Corp',review:filing(),headlines:[]});
  expect(r.subject).toBe('earnings_disclosure');
  expect(r.notes.join(' ')).toContain('not an earnings surprise');
  expect(r.notes.join(' ')).toContain('not an earnings surprise');
  expect(r.warnings).toContain('source_coverage_incomplete');
 });
 it('cautions on adverse filing text rather than making unsupported bullish interpretation',()=>{
  const f=filing();f.evidence!.cautions.push({label:'Downward guidance language',excerpt:'Reduced full-year outlook'});
  f.evidence!.topics=[{code:'5.02',label:'Leadership change'}];
  const r=assessCatalystEvidenceTimeline({filingDate:'2026-10-15',asOf:'2026-10-16',issuerName:'Alcoa Corp',review:f,headlines:[]});
  expect(r.subject).toBe('leadership_disclosure');
  expect(r.warnings).toContain('potential_adverse_filing_language');
 });
 it('renders the source chronology and an actionable optional price-context investigation',()=>{
  const html=renderToStaticMarkup(createElement(CatalystVerificationPanel,{ticker:'ACI',issuerName:'Alcoa Corp',filingDate:'2026-10-15',sourceUrl:url,review:filing(),headlines:[news('2026-10-13')],asOf:'2026-10-16'}));
  expect(html).toContain('Possible pre-filing disclosure');
  expect(html).toContain('Examine catalyst and stock reaction');
  expect(html).toContain('Results of operations');
  expect(html).toContain('0 on filing date');
  expect(html).not.toContain('Verified buy');
 });
});
