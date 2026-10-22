import {afterEach,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import RealWorkspace,{ReportedFundamentals,ResearchCaseQuestions,SavedResearchHandoff} from './RealWorkspace';
import type {SecCompany} from './ranking-model';
import type {readResearchContext} from './watchlist-research';

const source='https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json';
const current={year:2025,start:'2025-01-01',end:'2025-12-31',filed:'2026-02-12',value:150000000,unit:'USD',form:'10-K',accession:'0000000001-26-000001',tag:'Revenues',reviewIssues:[]};
const prior={...current,year:2024,start:'2024-01-01',end:'2024-12-31',filed:'2025-02-12',value:100000000,accession:'0000000001-25-000001'};
const company:SecCompany={ticker:'CASE',name:'Reported Evidence Fixture',cik:'0000000001',source,retrievedAt:'2026-10-20T12:00:00.000Z',classification:{status:'reported',system:'SEC SIC',code:'3531',description:'Synthetic industrial fixture',source:'https://data.sec.gov/submissions/CIK0000000001.json',retrievedAt:'2026-10-20T12:00:00.000Z'},metrics:[
 {name:'Revenue',tag:'Revenues',unit:'USD',reportingScope:'entity_wide',values:[{...current,tag:undefined},prior]},
 {name:'Operating cash flow',tag:'NetCashProvidedByUsedInOperatingActivities',unit:'USD',reportingScope:'total_operations',values:[{...current,tag:'NetCashProvidedByUsedInOperatingActivities',value:24000000}]},
 {name:'Capital expenditures',tag:'PaymentsToAcquirePropertyPlantAndEquipment',unit:'USD',reportingScope:'unallocated_cash_purchases',values:[{...current,tag:'PaymentsToAcquirePropertyPlantAndEquipment',value:4000000}]},
 {name:'Net income',tag:'ProfitLoss',unit:'USD',reportingScope:'consolidated',values:[{...current,tag:'ProfitLoss',value:12000000}]}
]};

afterEach(()=>vi.unstubAllGlobals());

describe('Obsidian Glass Company Research evidence boundaries',()=>{
 it('shows balanced empty research questions without inventing a company thesis',()=>{
  const html=renderToStaticMarkup(createElement(ResearchCaseQuestions));
  expect(html).toContain('Bull case · unassessed here');
  expect(html).toContain('Bear case · unassessed here');
  expect(html).toContain('No structured, company-specific bullish argument');
  expect(html).toContain('No structured, company-specific bearish argument');
  expect(html).not.toMatch(/buy recommendation|verified conviction/i);
 });

 it('keeps reported values distinct from derived metrics and displays filing identity',()=>{
  const html=renderToStaticMarkup(createElement(ReportedFundamentals,{company}));
  expect(html).toContain('Annual revenue</dt><dd>$150M</dd>');
  expect(html).toContain('SEC-reported consolidated net income');
  expect(html).toContain('ATLAS-derived PP&amp;E-only cash flow');
  expect(html).toContain('2025-01-01 to 2025-12-31 · USD · 10-K filed 2026-02-12');
  expect(html).toContain('Revenues · 0000000001-26-000001');
  expect(html).toContain('0000000001-26-000001');
  expect(html).toContain('separately reported software spending is not included');
  expect(html).toContain(source);
 });

 it('labels an investor draft as browser-local and does not invent its original evidence',()=>{
  const context:ReturnType<typeof readResearchContext>={summaries:[],filings:[],issues:[],theses:[{ticker:'CASE',createdAt:'2026-09-01T12:00:00.000Z',thesis:'Investor hypothesis',invalidation:'What would change it',verdict:'INSUFFICIENT EVIDENCE'}]};
  const html=renderToStaticMarkup(createElement(SavedResearchHandoff,{ticker:'CASE',context}));
  expect(html).toContain('Saved thesis draft');
  expect(html).toContain('Investor hypothesis');
  expect(html).toContain('original filing evidence was not saved with it');
  expect(html).not.toContain('Open saved SEC source');
 });

 it('links a saved SEC research summary while disclosing that its source is not frozen',()=>{
  const context:ReturnType<typeof readResearchContext>={theses:[],filings:[],issues:[],summaries:[{ticker:'CASE',createdAt:'2026-09-01T12:00:00.000Z',headline:'Previously saved SEC research',finding:'Earlier screening observation',action:'Investigate',source,verdict:'INSUFFICIENT EVIDENCE'}]};
  const html=renderToStaticMarkup(createElement(SavedResearchHandoff,{ticker:'CASE',context}));
  expect(html).toContain('Saved research conclusion');
  expect(html).toContain('Earlier screening observation');
  expect(html).toContain('Open saved SEC source');
  expect(html).toContain('live SEC dataset, not a frozen evidence snapshot');
  expect(html).toContain(source);
 });

 it('shows honest no-history and unavailable-storage states',()=>{
  const context:ReturnType<typeof readResearchContext>={summaries:[],theses:[],filings:[],issues:['Saved research is unavailable in this browser.']};
  const html=renderToStaticMarkup(createElement(SavedResearchHandoff,{ticker:'CASE',context}));
  expect(html).toContain('No saved assessment here yet');
  expect(html).toContain('Discovery screening history is not an investor thesis');
  expect(html).toContain('Saved research is unavailable in this browser.');
  vi.stubGlobal('localStorage',{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});
  const workspace=renderToStaticMarkup(createElement(RealWorkspace,{mode:'research',defaultTicker:'CASE'}));
  expect(workspace).toContain('Saved companies could not be read. Existing records were kept');
  expect(workspace).toContain('Saved notes could not be read. Existing records were kept');
  expect(workspace).toContain('Search SEC index');
 });
});
