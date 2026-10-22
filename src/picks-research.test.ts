import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {distinctIssuers,retainPickLeads,thisMonth,selectIssuerReviewBatch,type PickLead} from './picks-research';
import ResearchHome from './ResearchHome';
import MonthlyPicksDashboard from './MonthlyPicksDashboard';
import InvestmentOutcomeSimulator from './InvestmentOutcomeSimulator';
const a=(ticker:string,filed:string,form='8-K'):PickLead=>({ticker,name:'Issuer '+ticker,filed,form,kind:'8-K (unreviewed)',url:'https://www.sec.gov/Archives/edgar/data/1234/'+ticker+'-2026.txt'});
describe('Source-dated filing-led home and rolling SEC research ledger',()=>{
 it('preserves distinct SEC filings across observed month and 90-day ledgers without inventing archival completeness',()=>{
  const old=[a('OLD','2026-07-25'),a('STAL','2026-05-01')];
  const incoming=[a('OCT','2026-10-15'),a('OLD','2026-07-25'),a('NEXT','2026-10-20')];
  const rows=retainPickLeads(old,incoming,'2026-10-16');
  expect(rows.map(x=>x.ticker)).toEqual(['OCT','OLD']);
  expect(thisMonth(rows,'2026-10-16').map(x=>x.ticker)).toEqual(['OCT']);
  expect(rows).toHaveLength(2);
 });
 it('filters unsupported forms, malicious URLs, dates and duplicate same-issuer cards',()=>{
  const rows=retainPickLeads([],[
   a('TEST','2026-10-12'),{...a('TEST','2026-10-13'),url:'https://evil.example/filing.txt'},
   {...a('TEST','2026-10-11'),url:'https://www.sec.gov/Archives/edgar/data/1234/TEST-2026-2.txt'},a('OTHER','2026-10-10','10-K'),a('OTHER','2026-10-09','8-K/A')
  ],'2026-10-16');
  expect(rows).toHaveLength(3);
  expect(distinctIssuers(rows,3).map(x=>x.ticker)).toEqual(['TEST','OTHER']);
 });
 it('cycles across source-indexed issuers instead of rechecking the same first eight every refresh',()=>{
  const rows=Array.from({length:19},(_,i)=>a('S'+i,'2026-10-15'));
  const one=selectIssuerReviewBatch(rows,0,8);
  const two=selectIssuerReviewBatch(rows,one.nextOffset,8);
  const three=selectIssuerReviewBatch(rows,two.nextOffset,8);
  expect(one.rows).toHaveLength(8);
  expect(two.rows).toHaveLength(8);
  expect(three.rows).toHaveLength(3);
  expect(new Set([...one.rows,...two.rows,...three.rows].map(x=>x.ticker)).size).toBe(19);
  expect(three.nextOffset).toBe(0);
  expect(selectIssuerReviewBatch(rows,0,8).rows[0].ticker).toBe('S0');
 });
 it('deduplicates a repeat issuer and counts unique companies, not just filings',()=>{
  const rows=[a('AA','2026-10-15'),{...a('AA','2026-10-14'),url:'https://www.sec.gov/Archives/edgar/data/1234/AA-older.txt'},a('ABBV','2026-10-15')];
  const batch=selectIssuerReviewBatch(rows,0,8);
  expect(batch.rows.map(x=>x.ticker)).toEqual(['AA','ABBV']);
  expect(batch.totalIssuers).toBe(2);
  expect(selectIssuerReviewBatch([],0).rows).toEqual([]);
  expect(()=>selectIssuerReviewBatch(rows,0,25)).toThrow('Unsupported SEC review batch size');
 });
 it('opens the real-home source research workflow instead of a fictional top-picks claim',()=>{
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{}}));
  expect(html).toContain('Recent catalysts and SEC filing intelligence');
  expect(html).toContain('Separate evidence paths.');
  expect(html).toContain('may reach a different provisional conclusion');
  expect(html).not.toContain('Explore $500 dollar scenarios');
  expect(html).toContain('Review saved research');
  expect(html).toContain('<details class="atlas-home-secondary-intelligence">');
  expect(html.indexOf('No evidence-backed lead')).toBeLessThan(html.indexOf('Recent catalysts and SEC filing intelligence'));
  expect(html).not.toContain('atlas-picks-workbench');
  const queue=renderToStaticMarkup(createElement(MonthlyPicksDashboard,{heading:'Recent catalysts and SEC filing intelligence',showScenarioActions:false}));
  expect(queue).toContain('RESEARCH BRIEF');
  expect(queue).toContain('This month');
  expect(queue).toContain('Last 90 days');
  expect(queue).toContain('does not backfill a complete three-month SEC universe');
  expect(queue).toContain('How ATLAS orders this research queue');
  expect(queue).toContain('ATLAS is reviewing this batch');
  expect(html).toContain('Run Autonomous Discovery');
 });
 it('renders an amount slider that starts with $500 and a holding period without implying returns are assured',()=>{
  const html=renderToStaticMarkup(createElement(InvestmentOutcomeSimulator,{ticker:'TEST'}));
  expect(html).toContain('What could $500.00 turn into?');
  expect(html).toContain('Hypothetical investment amount');
  expect(html).toContain('Historical outcome horizon');
  expect(html).toContain('not');
  expect(html).not.toContain('Guaranteed profit');
 });
});
