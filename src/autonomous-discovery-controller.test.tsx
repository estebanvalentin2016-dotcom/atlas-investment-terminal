import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,describe,expect,it,vi} from 'vitest';
import AutonomousDiscovery from './AutonomousDiscovery';
import ResearchHome from './ResearchHome';
import {AUTO_72_COMPLETION_KEY,AUTO_72_FRESH_MS,createAutonomousDiscoveryController} from './autonomous-discovery-controller';
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
const fullPage=(cursor:number)=>({total:1000,start:cursor,nextCursor:cursor+24,completedCycle:false,rows:Array.from({length:24},(_,index)=>({ticker:`X${cursor+index}`,name:`X${cursor+index} Industries`,cik:1234567890})),indexUrl:'https://www.sec.gov/files/company_tickers.json',retrievedAt:'2026-10-15T12:00:00.000Z',seedTickersUsed:false,scope:'SEC index'});
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
  expect(renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},controller}))).toContain('Preparing an SEC discovery scan');
  expect(urls).toHaveLength(0); // Home never starts a scan.
  expect(renderToStaticMarkup(createElement(AutonomousDiscovery,{controller}))).toContain('Discover Opportunities');
  let notifications=0;
  const leaveDiscovery=controller.subscribe(()=>{notifications++});
  const run=controller.start();
  expect(controller.start()).toBe(run); // synchronous single-flight guard
  await waitFor(()=>urls.some(url=>url.startsWith('/api/sec/company')));
  leaveDiscovery(); // Discovery view unmounts; execution remains in the app controller.
  const homeDuring=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},controller}));
  expect(homeDuring).toContain('Discovery:');
  expect(homeDuring).toContain('Checking SEC issuers');
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
  expect(homeAfter).toContain('Scan complete');
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
  const home=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},controller}));
  expect(home).toContain('Discovery could not finish. No new briefing was saved.');
  expect(home).toContain('Retry the 72-company scan');
 });

 it('automatically starts one 72-entry run, then reuses its saved briefing for 24 hours',async()=>{
  const browserStorage=storage();vi.stubGlobal('localStorage',browserStorage);
  const startedAt=new Date('2026-10-22T18:00:00.000Z');
  const urls:string[]=[];
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
   const url=String(input);urls.push(url);
   if(url.startsWith('/api/autonomous/universe'))return json(fullPage(Number(new URL(url,'http://localhost').searchParams.get('cursor'))));
   if(url.startsWith('/api/sec/company'))return json(company(new URL(url,'http://localhost').searchParams.get('ticker')!));
   return json({error:'Price source unavailable'},503);
  }) as unknown as typeof fetch;
  const controller=createAutonomousDiscoveryController({fetcher,now:()=>startedAt});
  expect(urls).toHaveLength(0); // Initial Home render does not wait for or start I/O.
  const first=controller.startAutomaticallyIfEligible();
  expect(first).not.toBeNull();
  expect(controller.startAutomaticallyIfEligible()).toBe(first); // Strict Mode re-entry.
  expect(controller.getSnapshot()).toMatchObject({busy:true,batchCount:3,activeBatchCount:3});
  expect(renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},controller}))).toContain('Research is underway');
  await first;
  expect(urls.filter(url=>url.startsWith('/api/autonomous/universe'))).toEqual([
   '/api/autonomous/universe?cursor=0&limit=24',
   '/api/autonomous/universe?cursor=24&limit=24',
   '/api/autonomous/universe?cursor=48&limit=24'
  ]);
  expect(urls.filter(url=>url.startsWith('/api/sec/company'))).toHaveLength(72);
  expect(controller.getSnapshot()).toMatchObject({done:true,busy:false,checkedIssuers:72,scannedBatches:3});
  expect(controller.getSnapshot().briefing?.issuersExamined).toBe(72);
  const marker=JSON.parse(browserStorage.getItem(AUTO_72_COMPLETION_KEY)!);
  expect(marker).toMatchObject({version:1,requestedBatches:3,enumerated:72,issuersExamined:72});
  expect(browserStorage.getItem(BRIEFING_KEY)).not.toBeNull();

  const reuseFetcher=vi.fn() as unknown as typeof fetch;
  const reopened=createAutonomousDiscoveryController({fetcher:reuseFetcher,now:()=>new Date(startedAt.getTime()+AUTO_72_FRESH_MS-1)});
  expect(reopened.startAutomaticallyIfEligible()).toBeNull();
  expect(reopened.getSnapshot().briefing?.scanCompletedAt).toBe(marker.scanCompletedAt);
  expect(renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},controller:reopened}))).toContain('Recent scan available');
  expect(reuseFetcher).not.toHaveBeenCalled();
 });

 it('treats expired, malformed, or mismatched freshness metadata as ineligible',async()=>{
  const browserStorage=storage();vi.stubGlobal('localStorage',browserStorage);
  const timestamp='2026-10-20T18:00:00.000Z';
  browserStorage.setItem(BRIEFING_KEY,JSON.stringify({version:1,scanCompletedAt:timestamp,issuersExamined:72,leads:[]}));
  browserStorage.setItem(AUTO_72_COMPLETION_KEY,'{bad json');
  const fetcher=vi.fn(async()=>json({error:'SEC unavailable'},503)) as unknown as typeof fetch;
  const controller=createAutonomousDiscoveryController({fetcher,now:()=>new Date('2026-10-22T18:00:00.000Z')});
  await controller.startAutomaticallyIfEligible();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(controller.getSnapshot().briefing?.scanCompletedAt).toBe(timestamp);
  expect(controller.getSnapshot()).toMatchObject({done:false,error:'SEC unavailable'});
  expect(browserStorage.getItem(BRIEFING_KEY)).toContain(timestamp);

  browserStorage.setItem(AUTO_72_COMPLETION_KEY,JSON.stringify({version:1,requestedBatches:3,enumerated:72,scanCompletedAt:timestamp,issuersExamined:72}));
  const expired=createAutonomousDiscoveryController({fetcher,now:()=>new Date(Date.parse(timestamp)+AUTO_72_FRESH_MS)});
  await expired.startAutomaticallyIfEligible();
  expect(fetcher).toHaveBeenCalledTimes(2);
 });

 it('preserves the prior completed briefing on failure and allows an explicit 72-entry retry',async()=>{
  const browserStorage=storage();vi.stubGlobal('localStorage',browserStorage);
  const previous='2026-10-20T18:00:00.000Z';
  const previousBriefing=JSON.stringify({version:1,scanCompletedAt:previous,issuersExamined:24,leads:[]});
  browserStorage.setItem(BRIEFING_KEY,previousBriefing);
  let failFirst=true;
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
   const url=String(input);
   if(url.startsWith('/api/autonomous/universe')){
    if(failFirst){failFirst=false;return json({error:'SEC temporarily unavailable'},503)}
    return json(fullPage(Number(new URL(url,'http://localhost').searchParams.get('cursor'))));
   }
   if(url.startsWith('/api/sec/company'))return json(company(new URL(url,'http://localhost').searchParams.get('ticker')!));
   return json({error:'Price source unavailable'},503);
  }) as unknown as typeof fetch;
  const controller=createAutonomousDiscoveryController({fetcher,now:()=>new Date('2026-10-22T18:00:00.000Z')});
  await controller.startAutomaticallyIfEligible();
  expect(controller.getSnapshot()).toMatchObject({done:false,busy:false,error:'SEC temporarily unavailable'});
  expect(controller.getSnapshot().briefing?.scanCompletedAt).toBe(previous);
  expect(browserStorage.getItem(BRIEFING_KEY)).toBe(previousBriefing);
  expect(browserStorage.getItem(AUTO_72_COMPLETION_KEY)).toBeNull();
  expect(renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},controller}))).toContain('Retry the 72-company scan');
  await controller.retryAutomatic();
  expect(controller.getSnapshot()).toMatchObject({done:true,busy:false,error:'',checkedIssuers:72});
  expect(controller.getSnapshot().briefing?.scanCompletedAt).toBe('2026-10-22T18:00:00.000Z');
  expect(browserStorage.getItem(AUTO_72_COMPLETION_KEY)).not.toBeNull();
 });

 it('does not publish a partial three-batch scan when a later SEC index request fails',async()=>{
  const browserStorage=storage();vi.stubGlobal('localStorage',browserStorage);
  const prior=JSON.stringify({version:1,scanCompletedAt:'2026-10-20T18:00:00.000Z',issuersExamined:24,leads:[]});
  browserStorage.setItem(BRIEFING_KEY,prior);
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
   const url=String(input);
   if(url.startsWith('/api/autonomous/universe'))return url.includes('cursor=24')?json({error:'SEC index unavailable'},503):json(fullPage(0));
   if(url.startsWith('/api/sec/company'))return json(company(new URL(url,'http://localhost').searchParams.get('ticker')!));
   return json({error:'Price source unavailable'},503);
  }) as unknown as typeof fetch;
  const controller=createAutonomousDiscoveryController({fetcher});
  await controller.startAutomaticallyIfEligible();
  expect(controller.getSnapshot()).toMatchObject({done:false,busy:false,scannedBatches:1,checkedIssuers:24,error:'SEC index unavailable'});
  expect(browserStorage.getItem(BRIEFING_KEY)).toBe(prior);
  expect(browserStorage.getItem(AUTO_72_COMPLETION_KEY)).toBeNull();
  expect(browserStorage.getItem(RESEARCH_HISTORY_KEY)).toBeNull();
 });
});
