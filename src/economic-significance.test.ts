import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {assessEconomicSignificance} from './economic-significance';
import EconomicSignificancePanel from './EconomicSignificancePanel';
import type {SecCompany,Annual} from './ranking-model';
import type {FilingEvidenceResult} from './FilingEvidence';
const source='https://www.sec.gov/Archives/edgar/data/1234567/0001234567-26-000001.txt';
const direct='https://www.sec.gov/Archives/edgar/data/1234567/000123456726000001/ex991.htm';
const a=(year:number,v:number,filed=(year+1)+'-02-15'):Annual=>({year,end:year+'-12-31',filed,value:v,form:'10-K',accession:'0000000000-26-000001'});
const company=():SecCompany=>({ticker:'TEST',name:'Test Co',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0001234567.json',retrievedAt:'2026-10-16',metrics:[
 {name:'Revenue',values:[a(2025,1_500_000_000),a(2024,1_200_000_000)]},
 {name:'Operating cash flow',values:[a(2025,300_000_000)]},
 {name:'Capital expenditures',values:[a(2025,100_000_000)]}
]});
const review=(figures:{label:string;reportedValue:string}[]):FilingEvidenceResult=>({
 url:source,sourceStatus:'partial_text',reviewMethod:'selected_documents',note:'Selected filing and exhibits',sourceProblems:[],
 evidence:{status:'no_positive_phrase_detected',potential:[],cautions:[],textCharacters:400,limitations:'SEC source data',
  metrics:figures.map(m=>({...m,excerpt:'SEC reported: '+m.reportedValue,sourceUrl:direct})),topics:[{code:'2.02',label:'Results of operations'}]}
});
const assess=(rev:FilingEvidenceResult|null,co:SecCompany|null=company(),asOf='2026-10-16')=>
 assessEconomicSignificance({ticker:'TEST',filingUrl:source,review:rev,company:co,asOf});
describe('Economic significance only when the issuer source quantifies an actual reported change',()=>{
 it('extracts a positive SEC revenue trend but never upgrades it to earnings beat, valuation or return forecast',()=>{
  const x=assess(review([{label:'Reported revenue growth',reportedValue:'19% increase in revenue'}]));
  expect(x.status).toBe('quantified_improvement');
  expect(x.signals[0]).toMatchObject({category:'revenue_change',changePct:19,direction:'improvement',sourceUrl:direct});
  expect(x.annual).toMatchObject({fiscalYear:2025,revenue:1_500_000_000,reportedGrowthPct:25,fcf:200_000_000,fcfMarginPct:13.33});
  expect(x.sensitivity).toEqual({onePointAnnualFcf:15_000_000,threePointAnnualFcf:45_000_000});
  expect(x.verifiedEarningsSurprise).toBe(false);
  expect(x.fairValueImpact).toBe(false);
  expect(x.verifiedMateriality).toBe(false);
  expect(x.limitations.join(' ')).toContain('do NOT necessarily cover the same reporting period');
 });
 it('treats EPS decline and reported outflows as adverse, not an undiscounted buying opportunity',()=>{
  const x=assess(review([
   {label:'Reported EPS growth',reportedValue:'8% decline in adjusted diluted EPS'},
   {label:'Reported net outflows',reportedValue:'$25 billion of net outflows'}
  ]));
  expect(x.status).toBe('adverse_or_mixed');
  expect(x.signals.map(y=>y.direction)).toEqual(['deterioration','deterioration']);
  expect(x.signals[0].changePct).toBe(-8);
  expect(x.signals[1].changePct).toBeNull();
 });
 it('negative filing caution overrides attractive reported operating growth',()=>{
  const rev=review([{label:'Reported revenue growth',reportedValue:'19% increase in revenue'}]);
  rev.evidence!.cautions=[{label:'Downward guidance language',excerpt:'Lowered revenue guidance'}];
  expect(assess(rev).status).toBe('adverse_or_mixed');
 });
 it('AUM/inflow quantities are descriptive, not revenue growth or valuation impact',()=>{
  const x=assess(review([{label:'Reported assets under management',reportedValue:'$15.5 trillion in AUM'},
   {label:'Reported net inflows',reportedValue:'$205 billion of net inflows'}]));
  expect(x.status).toBe('descriptive_only');
  expect(x.signals.every(y=>y.changePct===null)).toBe(true);
 });
 it('does not interpret unsupported percent snippets, invalid sources or missing company data',()=>{
  const x=assess(review([
   {label:'Reported revenue growth',reportedValue:'19% growth'},
   {label:'Reported EPS growth',reportedValue:'300% increase in EPS'},
   {label:'Reported FCF growth',reportedValue:'55% increase in FCF'}
  ]),null);
  expect(x.status).toBe('unquantified');
  expect(x.annual).toBeNull();
  expect(x.sensitivity).toBeNull();
  const damaged=review([{label:'Reported revenue growth',reportedValue:'12% increase in revenue'}]);
  damaged.evidence!.metrics![0].sourceUrl='https://evil.example/not-sec';
  expect(assess(damaged).signals).toHaveLength(0);
 });
 it('excludes annual SEC data filed after the assessment date and refuses a mismatched 8-K accession',()=>{
  const co=company();co.metrics.find(m=>m.name==='Revenue')!.values[0]=a(2025,1_500_000_000,'2026-10-17');
  const x=assess(review([{label:'Reported revenue growth',reportedValue:'19% increase in revenue'}]),co);
  expect(x.annual).toBeNull(); // 2024 annual data are stale; a future-filed 2025 result cannot refresh them
  const wrong=review([]);wrong.url='https://www.sec.gov/Archives/edgar/data/9999999/0009999999-26-000001.txt';
  expect(assess(wrong).status).toBe('source_unavailable');
 });
 it('shows observed figures, date-qualified annual scale and an explicitly NON-forecast value sensitivity',()=>{
  const html=renderToStaticMarkup(createElement(EconomicSignificancePanel,{ticker:'TEST',filingUrl:source,asOf:'2026-10-16',
   review:review([{label:'Reported revenue growth',reportedValue:'19% increase in revenue'}]),company:company()}));
  expect(html).toContain('Does the catalyst actually change the business?');
  expect(html).toContain('+19.0%');
  expect(html).toContain('±$15M');
  expect(html).toContain('±$45M');
  expect(html).toContain('Not a forecast');
  expect(html).toContain('pre-release consensus');
  expect(html).toContain('Inspect SEC passage');
 });
});
