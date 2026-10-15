import {describe,it,expect,vi} from 'vitest';
// @ts-ignore Node-only SEC enumeration endpoint
import {enumerateTickerUniverse,handleSecRequest} from '../server/sec-api.mjs';
import {initialAutonomousScreen,scanCounts} from './autonomous-screen';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import AutonomousDiscovery from './AutonomousDiscovery';
import ResearchHome from './ResearchHome';
import App from './App';
import type {SecCompany} from './ranking-model';
const fy=(year:number,value:number)=>({year,end:year+'-12-31',filed:(year+1)+'-02-15',value,form:'10-K',accession:'0000000000-26-000100'});
const company=():SecCompany=>({ticker:'XRAN',name:'Unfamiliar Industrial Company',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK1234567890.json',retrievedAt:'2026-10-15',metrics:[
 {name:'Revenue',values:[fy(2025,150),fy(2024,100)]},
 {name:'Operating cash flow',values:[fy(2025,32)]},
 {name:'Capital expenditures',values:[fy(2025,6)]},
 {name:'Net income',values:[fy(2025,12)]}
]});
describe('Zero-ticker independent SEC universe enumeration',()=>{
 const index=Object.fromEntries(Array.from({length:57},(_,i)=>[String(i),{ticker:'X'+String(i).padStart(3,'0'),title:'Company '+i+' Industries',cik_str:100000+i}]));
 it('enumerates arbitrary SEC issuers without receiving a manually selected ticker',()=>{
  const result=enumerateTickerUniverse(index,0,24);
  expect(result.total).toBe(57);
  expect(result.rows).toHaveLength(24);
  expect(result.rows.some((row:{ticker:string})=>row.ticker.startsWith('X'))).toBe(true);
  expect(result.rows.every((row:{name:string,cik:number})=>Boolean(row.name)&&row.cik>0)).toBe(true);
 });
 it('visits the whole discovered SEC index using non-overlapping cursor batches',()=>{
  const a=enumerateTickerUniverse(index,0,24);
  const b=enumerateTickerUniverse(index,a.nextCursor,24);
  const c=enumerateTickerUniverse(index,b.nextCursor,24);
  const all=[...a.rows,...b.rows,...c.rows].map((x:{ticker:string})=>x.ticker);
  expect(all).toHaveLength(57);
  expect(new Set(all).size).toBe(57);
  expect(c.completedCycle).toBe(true);
  expect(c.nextCursor).toBe(0);
 });
 it('validates the universe route without requiring a ticker parameter',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS contact sec-tests@example.com');
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(index),{status:200})));
  let status=0,body='';
  try{
   await handleSecRequest({url:'/api/autonomous/universe?cursor=0&limit=12',method:'GET'},{writeHead(c:number){status=c},end(s:string){body=s}});
   const result=JSON.parse(body);
   expect(status).toBe(200);
   expect(result.total).toBe(57);
   expect(result.seedTickersUsed).toBe(false);
   expect(result.rows).toHaveLength(12);
   expect(result.scope).toContain('not verified exchange');
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
 });
});
describe('Autonomous first-stage evidence screening',()=>{
 it('passes a genuinely SEC-sourced unfamiliar company using operating FCF after capex',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-15T17:00:00Z'));
  try{
   const result=initialAutonomousScreen(company(),'2026-10-15');
   expect(result).toMatchObject({ticker:'XRAN',status:'preliminary_pass',growth:50});
   expect(result.fcfMargin).toBeGreaterThan(0);
   expect(result.score).not.toBeNull();
  }finally{vi.useRealTimers()}
 });
 it('will not rank an issuer with negative FCF as a promising initial pass',()=>{
  const data=company();
  data.metrics.find(x=>x.name==='Operating cash flow')!.values=[fy(2025,-30)];
  expect(initialAutonomousScreen(data,'2026-10-15').status).toBe('failed_thresholds');
 });
 it('screens net margin using the underlying SEC profitMargin metric',()=>{
  const losing=company();
  losing.metrics.find(x=>x.name==='Net income')!.values=[fy(2025,-18)];
  const rejected=initialAutonomousScreen(losing,'2026-10-15');
  expect(rejected.netMargin).toBe(-12);
  expect(rejected.status).toBe('failed_thresholds');
  expect(rejected.reasons).toContain('Net margin below provisional −10% threshold');
  const missing=company();
  missing.metrics.find(x=>x.name==='Net income')!.values=[];
  expect(initialAutonomousScreen(missing,'2026-10-15').status).toBe('incomplete_financials');
 });
 it('keeps missing and stale financials separate from genuine screening failures',()=>{
  const data=company();
  data.metrics.find(x=>x.name==='Capital expenditures')!.values=[];
  expect(initialAutonomousScreen(data,'2026-10-15').status).toBe('incomplete_financials');
  expect(initialAutonomousScreen(company(),'2028-10-15').status).toBe('stale_financials');
 });
 it('reports a count for every screening stage without inventing a qualifying buy verdict',()=>{
  const records=[{...initialAutonomousScreen(company(),'2026-10-15'),status:'preliminary_pass' as const},{...initialAutonomousScreen(company(),'2026-10-15'),status:'incomplete_financials' as const}];
  expect(scanCounts(records,2,4)).toEqual({enumerated:4,financialRecordsChecked:2,sourceFailures:2,preliminary:1,incomplete:1,failed:0,stale:0});
 });
});
describe('Independent discovery user journey',()=>{
 it('requires no ticker input before showing a discover action',()=>{
  const html=renderToStaticMarkup(createElement(AutonomousDiscovery));
  expect(html).toContain('Discover Opportunities');
  expect(html).toContain('without entering a ticker');
  expect(html).not.toContain('Ticker shortlist');
  expect(html).not.toContain('BLK, NVDA');
 });
 it('offers real tickerless discovery from home while keeping all older research tabs',()=>{
  const home=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{}}));
  const app=renderToStaticMarkup(createElement(App));
  expect(home).toContain('Discover Opportunities');
  expect(app).toContain('Autonomous Discovery');
  expect(app).toContain('Opportunity Radar');
  expect(app).toContain('Institutional Consensus');
  expect(app).toContain('Conviction Lab');
 });
});
