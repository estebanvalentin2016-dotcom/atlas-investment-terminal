import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,describe,expect,it,vi} from 'vitest';
import AutonomousDiscovery from './AutonomousDiscovery';
import ResearchHome from './ResearchHome';
import {createAutonomousDiscoveryController} from './autonomous-discovery-controller';
import {KEY as BRIEFING_KEY} from './discovery-briefing-storage';
import {KEY as PASSES_KEY} from './autonomous-pass-ledger';
import {RESEARCH_HISTORY_KEY} from './research-history-storage';

const storage=()=>{
 const values=new Map<string,string>();
 return {
  getItem:(key:string)=>values.get(key)??null,
  setItem:(key:string,value:string)=>{values.set(key,value)},
  removeItem:(key:string)=>{values.delete(key)},
  clear:()=>{values.clear()},
  key:(index:number)=>[...values.keys()][index]??null,
  get length(){return values.size}
 } as Storage;
};
const fact=(year:number,value:number)=>({year,start:`${year}-01-01`,end:`${year}-12-31`,filed:`${year+1}-02-15`,value,unit:'USD',form:'10-K',accession:`0000000000-${String(year%100).padStart(2,'0')}-000100`,reviewIssues:[]});
const company=(ticker:string)=>({
 ticker,name:`${ticker} Industries`,cik:'1234567890',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK1234567890.json',retrievedAt:'2026-10-15T12:00:00.000Z',classification:null,
 metrics:[
  {name:'Revenue',tag:'Revenues',unit:'USD',reportingScope:'entity_wide',values:[fact(2025,150),fact(2024,100)]},
  {name:'Operating cash flow',tag:'NetCashProvidedByUsedInOperatingActivities',unit:'USD',reportingScope:'total_operations',values:[fact(2025,32)]},
  {name:'Capital expenditures',tag:'PaymentsToAcquirePropertyPlantAndEquipment',unit:'USD',reportingScope:'unallocated_cash_purchases',values:[fact(2025,6)]},
  {name:'Net income',tag:'NetIncomeLoss',unit:'USD',reportingScope:'parent_attributable',values:[fact(2025,12)]}
 ]
});
const page=(cursor:number,completedCycle=false)=>({total:72,start:cursor,nextCursor:cursor+1,completedCycle,rows:[{ticker:`X${cursor}`,name:`X${cursor} Industries`,cik:1234567890}],indexUrl:'https://www.sec.gov/files/company_tickers.json',retrievedAt:'2026-10-15T12:00:00.000Z',seedTickersUsed:false,scope:'SEC index'});
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
const waitFor=async(predicate:()=>boolean)=>{for(let i=0;i<50&&!predicate();i++)await new Promise(resolve=>setTimeout(resolve,0));expect(predicate()).toBe(true)};

afterEach(()=>vi.unstubAllGlobals());

describe('persistent Autonomous Discovery controller',()=>{
 it('guards reentrant starts before notifying subscribers',async()=>{
  vi.stubGlobal('localStorage',storage());
  const fetcher=vi.fn(async()=>json({error:'SEC unavailable'},503)) as unknown as typeof fetch;
  const controller=createAutonomousDiscoveryController({fetcher});
  let reentered:Promise<void>|null=null;
  controller.subscribe(()=>{if(controller.getSnapshot().busy&&!reentered)reentered=controller.start()});
  const first=controller.start();
  expect(reentered).toBe(first);
  await first;
  expect(fetcher).toHaveBeenCalledTimes(1);
 });

 it('keeps one manual scan alive across view navigation, exposes progress on Home, and returns to the same results',async()=>{
  const browserStorage=storage();vi.stubGlobal('localStorage',browserStorage);
  let releaseCompany!:()=>void;
  const companyGate=new Promise<void>(resolve=>{releaseCompany=resolve});
  const urls:string[]=[];
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
   const url=String(input);urls.push(url);
   if(url.startsWith('/api/autonomous/universe'))return json(page(0));
   if(url.startsWith('/api/sec/company')){await companyGate;return json(company('X0'))}
   return json({error:'Price source unavailable'},503);
  }) as unknown as typeof fetch;
  const controller=createAutonomousDiscoveryController({fetcher});
  expect(renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},controller}))).toContain('No scan running');
  expect(urls).toHaveLength(0); // Home never starts a scan.
  expect(renderToStaticMarkup(createElement(AutonomousDiscovery,{controller}))).toContain('Discover Opportunities');
  let notifications=0;
  const leaveDiscovery=controller.subscribe(()=>{notifications++});
  const run=controller.start();
  expect(controller.start()).toBe(run); // synchronous single-flight guard
  await waitFor(()=>urls.some(url=>url.startsWith('/api/sec/company')));
  leaveDiscovery(); // Discovery view unmounts; execution remains in the app controller.
  const homeDuring=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},controller}));
  expect(homeDuring).toContain('Discovery scan:');
  expect(homeDuring).toContain('Enumerating SEC company batch 1 of 1');
  expect(controller.getSnapshot().busy).toBe(true);
  releaseCompany();await run;
  expect(notifications).toBeGreaterThan(0);
  expect(controller.getSnapshot()).toMatchObject({done:true,busy:false,scannedBatches:1,error:''});
  expect(urls.filter(url=>url.startsWith('/api/autonomous/universe'))).toHaveLength(1);
  expect(controller.getSnapshot().briefing?.issuersExamined).toBe(1);
  expect(browserStorage.getItem(BRIEFING_KEY)).not.toBeNull();
  const homeAfter=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},controller}));
  const discoveryAfter=renderToStaticMarkup(createElement(AutonomousDiscovery,{controller}));
  expect(homeAfter).toContain('1 real issuer was examined');
  expect(homeAfter).toContain('Discovery scan:');
  expect(discoveryAfter).toContain('X0 · X0 Industries');
  expect(discoveryAfter).toContain('Discover more companies');
 });

 it('retains the 24/72 manual choices, cursor sequence, and ignores repeated starts or mid-run choice changes',async()=>{
  vi.stubGlobal('localStorage',storage());
  const urls:string[]=[];
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
   const url=String(input);urls.push(url);
   if(url.startsWith('/api/autonomous/universe')){
    const cursor=Number(new URL(url,'http://localhost').searchParams.get('cursor'));
    return json(page(cursor,cursor===2));
   }
   if(url.startsWith('/api/sec/company'))return json(company(new URL(url,'http://localhost').searchParams.get('ticker')!));
   return json({error:'Price source unavailable'},503);
  }) as unknown as typeof fetch;
  const controller=createAutonomousDiscoveryController({fetcher});
  controller.setBatchCount(2);expect(controller.getSnapshot().batchCount).toBe(1);
  controller.setBatchCount(3);
  const run=controller.start();
  controller.setBatchCount(1);
  expect(controller.getSnapshot().batchCount).toBe(3);
  expect(controller.start()).toBe(run);
  await run;
  expect(urls.filter(url=>url.includes('/api/autonomous/universe'))).toEqual([
   '/api/autonomous/universe?cursor=0&limit=24',
   '/api/autonomous/universe?cursor=1&limit=24',
   '/api/autonomous/universe?cursor=2&limit=24'
  ]);
  expect(controller.getSnapshot()).toMatchObject({done:true,scannedBatches:3,cursor:3});
  expect(controller.getSnapshot().allListed).toHaveLength(3);
  expect(controller.getSnapshot().briefing?.issuersExamined).toBe(3);
 });

 it('reports a failed scan without publishing completed briefing or screening history',async()=>{
  const browserStorage=storage();vi.stubGlobal('localStorage',browserStorage);
  const controller=createAutonomousDiscoveryController({fetcher:vi.fn(async()=>json({error:'SEC access unavailable'},503)) as unknown as typeof fetch});
  await controller.start();
  expect(controller.getSnapshot()).toMatchObject({done:false,busy:false,error:'SEC access unavailable',briefing:null});
  expect(browserStorage.getItem(BRIEFING_KEY)).toBeNull();
  expect(browserStorage.getItem(PASSES_KEY)).toBeNull();
  expect(browserStorage.getItem(RESEARCH_HISTORY_KEY)).toBeNull();
  expect(renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},controller}))).toContain('Unavailable · SEC access unavailable');
 });
});
