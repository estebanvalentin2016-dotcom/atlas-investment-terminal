import {afterEach,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import RealWorkspace,{createRequestSequence} from './RealWorkspace';
import {readWorkspaceStorage,WATCH_KEY} from './watchlist-storage';
// @ts-ignore JavaScript-only SEC backend module is tested directly.
import {handleSecRequest} from '../server/sec-api.mjs';

const issuers=[
 {ticker:'NVDA',name:'NVIDIA CORP',cik:1045810,sic:'3674',description:'Semiconductors & Related Devices'},
 {ticker:'AMD',name:'ADVANCED MICRO DEVICES INC',cik:2488,sic:'3674',description:'Semiconductors & Related Devices'},
 {ticker:'CRWD',name:'CrowdStrike Holdings, Inc.',cik:1535527,sic:'7372',description:'Services-Prepackaged Software'}
] as const;

function memory(initial:Record<string,string>={}):Storage{
 const entries=new Map(Object.entries(initial));
 return {get length(){return entries.size},clear(){entries.clear()},getItem:key=>entries.get(key)??null,key:index=>[...entries.keys()][index]??null,removeItem:key=>entries.delete(key),setItem:(key,value)=>entries.set(key,value)};
}

async function request(url:string){
 let status=0,body='';
 await handleSecRequest({url,method:'GET'},{writeHead(code:number){status=code},end(value:string){body=value}});
 return {status,data:JSON.parse(body)};
}

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});

describe('on-demand SEC identity independent of Discovery',()=>{
 it('resolves exact NVDA, AMD and CRWD tickers to their CIKs and SEC-reported SICs',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS contact sec-tests@example.com');
  vi.stubGlobal('fetch',vi.fn(async(input:string|URL|Request)=>{
   const url=String(input);
   if(url.endsWith('/company_tickers.json'))return new Response(JSON.stringify(Object.fromEntries(issuers.map((issuer,index)=>[index,{ticker:issuer.ticker,title:issuer.name,cik_str:issuer.cik}]))),{status:200});
   const issuer=issuers.find(item=>url.endsWith('/CIK'+String(item.cik).padStart(10,'0')+'.json'));
   if(!issuer)return new Response('not found',{status:404});
   if(url.includes('/companyfacts/'))return new Response(JSON.stringify({entityName:issuer.name,facts:{}}),{status:200});
   if(url.includes('/submissions/'))return new Response(JSON.stringify({sic:issuer.sic,sicDescription:issuer.description}),{status:200});
   return new Response('not found',{status:404});
  }));

  for(const issuer of issuers){
   const search=await request('/api/sec/search?q='+issuer.ticker);
   expect(search.status).toBe(200);
   expect(search.data.items[0]).toEqual({ticker:issuer.ticker,name:issuer.name,cik:issuer.cik});

   const company=await request('/api/sec/company?ticker='+issuer.ticker);
   expect(company.status).toBe(200);
   expect(company.data).toMatchObject({ticker:issuer.ticker,name:issuer.name,cik:String(issuer.cik).padStart(10,'0')});
   expect(company.data.classification).toMatchObject({status:'reported',code:issuer.sic,description:issuer.description,source:'https://data.sec.gov/submissions/CIK'+String(issuer.cik).padStart(10,'0')+'.json'});
   expect(company.data.source).toBe('https://data.sec.gov/api/xbrl/companyfacts/CIK'+String(issuer.cik).padStart(10,'0')+'.json');
  }
 });

 it('renders saved issuers and research entry points without a Discovery snapshot',()=>{
  const storage=memory({[WATCH_KEY]:JSON.stringify(issuers.map(({ticker,name,cik})=>({ticker,name,cik})))});
  vi.stubGlobal('localStorage',storage);
  expect(readWorkspaceStorage(storage).watch).toHaveLength(3);
  const watchlist=renderToStaticMarkup(createElement(RealWorkspace,{mode:'watchlist'}));
  for(const issuer of issuers){
   expect(watchlist).toContain(issuer.name);
   expect(watchlist).toContain('Remove '+issuer.ticker+' from watchlist');
  }
  expect(watchlist.match(/Research company →/g)).toHaveLength(3);
  expect(watchlist).toContain('No saved scan is available');
  const research=renderToStaticMarkup(createElement(RealWorkspace,{mode:'research',defaultTicker:'CRWD'}));
  expect(research).toContain('value="CRWD"');
  expect(research).toContain('Search SEC index');
 });
});

describe('overlapping company research requests',()=>{
 it('accepts only the latest selection, including when an older request fails',()=>{
  const sequence=createRequestSequence();
  const nvda=sequence.begin();
  const amd=sequence.begin();
  expect(sequence.isCurrent(nvda)).toBe(false);
  expect(sequence.isCurrent(amd)).toBe(true);
  const crwd=sequence.begin();
  expect(sequence.isCurrent(amd)).toBe(false);
  expect(sequence.isCurrent(crwd)).toBe(true);
  sequence.invalidate();
  expect(sequence.isCurrent(crwd)).toBe(false);
 });
});
