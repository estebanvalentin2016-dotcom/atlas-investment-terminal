import {describe,it,expect} from 'vitest';
import {assessCatalystFundamentalBridge,type CandidateHeadline} from './catalyst-fundamental-bridge';
import type {FilingEvidenceResult} from './FilingEvidence';
import type {MarketValuationClose,SecCompany,Annual} from './ranking-model';
const filingUrl='https://www.sec.gov/Archives/edgar/data/1234567/0001234567-26-000001.txt';
const annual=(year:number,value:number):Annual=>({year,end:year+'-12-31',filed:(year+1)+'-02-15',value,form:'10-K',accession:'0001234567-26-000010'});
const company=():SecCompany=>({ticker:'TEST',name:'Test Growth Inc',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0001234567.json',retrievedAt:'2026-10-16',metrics:[
 {name:'Revenue',values:[annual(2025,120_000_000),annual(2024,100_000_000)]},
 {name:'Operating cash flow',values:[annual(2025,30_000_000)]},
 {name:'Capital expenditures',values:[annual(2025,5_000_000)]},
 {name:'Net income',values:[annual(2025,18_000_000)]},
 {name:'Diluted EPS',values:[annual(2025,4)]}
]});
const quote=():MarketValuationClose=>({ticker:'TEST',provider:'Alpaca',feed:'IEX',price:100,sessionDate:'2026-10-14',completedSession:true});
const news=(title='Test Growth raises full-year guidance'):CandidateHeadline=>({title,source:'Example Reporter',link:'https://news.google.com/rss/articles/fake',feedPublishedAt:'2026-10-15T14:00:00.000Z',feedDateOnly:null});
const review=():FilingEvidenceResult=>({url:filingUrl,sourceStatus:'reviewed_text',note:'Selected 8-K and exhibits read',evidence:{status:'potential_language',potential:[{label:'Raised outlook / guidance',excerpt:'We raise full-year guidance.'}],cautions:[],metrics:[],topics:[],textCharacters:100,limitations:'Text matching only.'}});
const inputs=()=>({ticker:'TEST',name:'Test Growth Inc',filed:'2026-10-15',filingUrl,asOf:'2026-10-16',review:review(),headlines:[news()],company:company(),quote:quote()});
describe('Point-in-time catalyst + SEC fundamental + valuation bridge',()=>{
 it('links a positive SEC development to an issuer-and-topic headline, financial pass and dated FY P/E without issuing a buy',()=>{
  const x=assessCatalystFundamentalBridge(inputs());
  expect(x.status).toBe('provisional_alignment');
  expect(x.topic).toBe('guidance');
  expect(x.verified).toEqual({issuerFiling:true,secAnnualFinancials:true,completedClose:true});
  expect(x.screen?.growth).toBe(20);
  expect(x.screen?.fcfMargin).toBeGreaterThan(0);
  expect(x.fyPe).toBe(25);
  expect(x.priority).toBeGreaterThan(0);
  expect(x.interpretation).toContain('NOT verified article corroboration');
  expect(x.gaps.join(' ')).toContain('intrinsic value remain unverified');
 });
 it('accepts full targeted primary and all listed Exhibit 99 files for provisional triage, without asserting whole-filing or article corroboration',()=>{
  const targeted:FilingEvidenceResult={...review(),sourceStatus:'partial_text',reviewMethod:'selected_documents',
   selection:{primaryLocated:true,exhibitsListed:1,selectedExhibits:1},sourceProblems:[],
   documents:[
    {role:'Primary 8-K',name:'form8k.htm',url:filingUrl,status:'reviewed'},
    {role:'Exhibit 99',name:'ex99.htm',url:filingUrl,status:'reviewed'}
   ]};
  const result=assessCatalystFundamentalBridge({...inputs(),review:targeted});
  expect(result.status).toBe('provisional_alignment');
  expect(result.verified.issuerFiling).toBe(true);
  expect(result.gaps.join(' ')).toContain('not comprehensively reviewed');
  expect(result.interpretation).toContain('NOT verified article corroboration');
  const incomplete={...targeted,selection:{primaryLocated:true,exhibitsListed:2,selectedExhibits:1}};
  const blocked=assessCatalystFundamentalBridge({...inputs(),review:incomplete});
  expect(blocked.status).toBe('not_aligned');
  expect(blocked.verified.issuerFiling).toBe(false);
  const trunc={...targeted,documents:[...targeted.documents!.slice(0,1),{role:'Exhibit 99',name:'ex99.htm',url:filingUrl,status:'partial'}]};
  expect(assessCatalystFundamentalBridge({...inputs(),review:trunc}).priority).toBeNull();
 });
 it('does not promote a clean targeted SEC filing with no positive catalyst language',()=>{
  const r=review();r.evidence!.potential=[];
  const x=assessCatalystFundamentalBridge({...inputs(),review:r});
  expect(x.status).toBe('not_aligned');
  expect(x.priority).toBeNull();
  expect(x.gaps.join(' ')).toContain('No SEC positive-language topic');
 });
 it('rejects ticker-collision stories and unrelated positive news',()=>{
  const other=assessCatalystFundamentalBridge({...inputs(),name:'Alcoa Corp',headlines:[news('American Airlines raises its FY outlook')]});
  expect(other.status).toBe('not_aligned');
  expect(other.priority).toBeNull();
  expect(other.topic).toBeNull();
  const different=assessCatalystFundamentalBridge({...inputs(),headlines:[news('Test Growth wins a government contract')]});
  expect(different.status).toBe('not_aligned');
 });
 it('does not classify adverse SEC text as bullish even when positive words and strong financials coexist',()=>{
  const r=review();r.evidence!.cautions.push({label:'Downward guidance language',excerpt:'Lowered outlook'});
  const x=assessCatalystFundamentalBridge({...inputs(),review:r});
  expect(x.status).toBe('caution');
  expect(x.priority).toBeNull();
 });
 it('blocks provisional bullish promotion when a disclosed EPS decline offsets favorable guidance language',()=>{
  const filing=review();
  filing.evidence!.metrics=[{label:'Reported EPS growth',reportedValue:'8% decline in adjusted diluted EPS',excerpt:'8% decline in adjusted diluted EPS',
   sourceUrl:'https://www.sec.gov/Archives/edgar/data/1234567/000123456726000001/ex991.htm'}];
  const r=assessCatalystFundamentalBridge({...inputs(),review:filing});
  expect(r.economicStatus).toBe('adverse_or_mixed');
  expect(r.status).toBe('caution');
  expect(r.priority).toBeNull();
  expect(r.gaps.join(' ')).toContain('adverse or mixed company-reported');
  const positive=review();
  positive.evidence!.metrics=[{label:'Reported revenue growth',reportedValue:'19% increase in revenue',excerpt:'19% increase in revenue',
   sourceUrl:'https://www.sec.gov/Archives/edgar/data/1234567/000123456726000001/ex991.htm'}];
  const candidate=assessCatalystFundamentalBridge({...inputs(),review:positive});
  expect(candidate.economicStatus).toBe('quantified_improvement');
  expect(candidate.status).toBe('provisional_alignment');
  expect(candidate.interpretation).toContain('NOT verified article corroboration');
 });
 it('blocks rich annual P/E, negative FCF, partial filing and source failure separately',()=>{
  const high=assessCatalystFundamentalBridge({...inputs(),quote:{...quote(),price:180}});
  expect(high.status).toBe('not_aligned');
  expect(high.fyPe).toBe(45);
  const badCompany=company();
  badCompany.metrics.find(m=>m.name==='Operating cash flow')!.values=[annual(2025,-30_000_000)];
  expect(assessCatalystFundamentalBridge({...inputs(),company:badCompany}).status).toBe('not_aligned');
  const partial={...review(),sourceStatus:'partial_text' as const};
  expect(assessCatalystFundamentalBridge({...inputs(),review:partial}).status).toBe('not_aligned');
  expect(assessCatalystFundamentalBridge({...inputs(),company:null}).priority).toBeNull();
 });
 it('does not mistake a pre-filing publisher headline for a new SEC-driven event',()=>{
  const early=assessCatalystFundamentalBridge({...inputs(),headlines:[{...news(),feedPublishedAt:'2026-10-13T13:00:00.000Z'}]});
  expect(early.status).toBe('not_aligned');
  expect(early.topic).toBeNull();
  expect(early.gaps.join(' ')).toContain('Pre-filing stories');
  const future=assessCatalystFundamentalBridge({...inputs(),headlines:[{...news(),feedPublishedAt:'2026-10-17T13:00:00.000Z'}]});
  expect(future.topic).toBeNull();
  expect(future.priority).toBeNull();
  const onDate=assessCatalystFundamentalBridge(inputs());
  expect(onDate.topic).toBe('guidance');
 });
 it('does not match stale/after-as-of news or a filing after the date of research',()=>{
  const far=assessCatalystFundamentalBridge({...inputs(),headlines:[{...news(),feedPublishedAt:'2026-09-01T11:00:00.000Z'}]});
  expect(far.status).toBe('not_aligned');
  const future=assessCatalystFundamentalBridge({...inputs(),filed:'2026-10-20'});
  expect(future.priority).toBeNull();
  expect(future.status).not.toBe('provisional_alignment');
 });
 it('requires the completed IEX quote to be recent, for the same issuer and a valid annual EPS',()=>{
  expect(assessCatalystFundamentalBridge({...inputs(),quote:{...quote(),ticker:'OTHER'}}).priority).toBeNull();
  expect(assessCatalystFundamentalBridge({...inputs(),quote:{...quote(),sessionDate:'2026-09-20'}}).priority).toBeNull();
  const c=company();c.metrics=c.metrics.filter(x=>x.name!=='Diluted EPS');
  expect(assessCatalystFundamentalBridge({...inputs(),company:c}).fyPe).toBeNull();
 });
});
