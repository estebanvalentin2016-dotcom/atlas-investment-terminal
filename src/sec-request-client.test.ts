import {describe,expect,it,vi} from 'vitest';
// @ts-ignore Node-only shared SEC transport is tested directly.
import {createSecRequestClient,publicSecError,SecRequestError,SEC_REQUEST_INTERVAL_MS} from '../server/sec-request-client.mjs';

const identityProvider=()=> 'ATLAS tests sec-reliability@example.org';
const jsonResponse=(value:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(value),{status,headers});

describe('shared SEC request scheduling',()=>{
 it('paces concurrent workflows through one aggregate start gate',async()=>{
  let clock=0;
  const starts:number[]=[];
  const sleep=vi.fn(async(ms:number)=>{clock+=ms});
  const fetchImpl=vi.fn(async()=>{starts.push(clock);return jsonResponse({ok:true})});
  const client=createSecRequestClient({fetchImpl,now:()=>clock,sleep,identityProvider});
  await Promise.all([
   client.json('https://www.sec.gov/files/company_tickers.json'),
   client.json('https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json'),
   client.json('https://data.sec.gov/submissions/CIK0000000001.json'),
   client.request('https://www.sec.gov/Archives/edgar/data/1/filing.txt',{accept:'text/plain'})
  ]);
  expect(starts).toEqual([0,SEC_REQUEST_INTERVAL_MS,SEC_REQUEST_INTERVAL_MS*2,SEC_REQUEST_INTERVAL_MS*3]);
  expect(fetchImpl).toHaveBeenCalledTimes(4);
 });

 it('deduplicates simultaneous identical JSON retrievals',async()=>{
  let release=()=>{};
  const gate=new Promise<void>(resolve=>{release=resolve});
  const fetchImpl=vi.fn(async()=>{await gate;return jsonResponse({issuer:'same'})});
  const client=createSecRequestClient({fetchImpl,minIntervalMs:0,identityProvider});
  const first=client.json('https://data.sec.gov/submissions/CIK0000000002.json');
  const second=client.json('https://data.sec.gov/submissions/CIK0000000002.json');
  release();
  const [a,b]=await Promise.all([first,second]);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(a.data).toEqual({issuer:'same'});
  expect(b.data).toEqual(a.data);
 });

 it('deduplicates simultaneous identical filing responses',async()=>{
  let release=()=>{};
  const gate=new Promise<void>(resolve=>{release=resolve});
  const fetchImpl=vi.fn(async()=>{await gate;return new Response('filing evidence')});
  const client=createSecRequestClient({fetchImpl,minIntervalMs:0,identityProvider});
  const url='https://www.sec.gov/Archives/edgar/data/1/filing.txt';
  const first=client.request(url,{accept:'text/plain'});
  const second=client.request(url,{accept:'text/plain'});
  release();
  const [a,b]=await Promise.all([first,second]);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  await expect(a.text()).resolves.toBe('filing evidence');
  await expect(b.text()).resolves.toBe('filing evidence');
 });

 it('reuses successful cache entries, preserves their retrieval time, and expires them',async()=>{
  let clock=Date.parse('2026-10-18T12:00:00.000Z'),sequence=0;
  const fetchImpl=vi.fn(async()=>jsonResponse({sequence:++sequence}));
  const client=createSecRequestClient({fetchImpl,now:()=>clock,minIntervalMs:0,identityProvider});
  const url='https://www.sec.gov/files/company_tickers.json';
  const first=await client.json(url,{cacheTtlMs:1000});
  clock+=999;
  const cached=await client.json(url,{cacheTtlMs:1000});
  clock+=1;
  const refreshed=await client.json(url,{cacheTtlMs:1000});
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(first).toMatchObject({data:{sequence:1},cacheStatus:'retrieved'});
  expect(cached).toMatchObject({data:{sequence:1},cacheStatus:'cached',retrievedAt:first.retrievedAt});
  expect(refreshed).toMatchObject({data:{sequence:2},cacheStatus:'retrieved'});
  expect(refreshed.retrievedAt).not.toBe(first.retrievedAt);
 });
});

describe('shared SEC retries and sanitized failures',()=>{
 it('honors Retry-After and bounds transient 5xx retries',async()=>{
  let clock=0,calls=0;
  const delays:number[]=[];
  const sleep=vi.fn(async(ms:number)=>{delays.push(ms);clock+=ms});
  const fetchImpl=vi.fn(async()=>{
   calls++;
   if(calls===1)return new Response('slow down',{status:429,headers:{'Retry-After':'1'}});
   if(calls===2)return new Response('temporary',{status:503});
   return jsonResponse({ok:true});
  });
  const client=createSecRequestClient({fetchImpl,now:()=>clock,sleep,minIntervalMs:0,identityProvider});
  await expect(client.json('https://data.sec.gov/submissions/CIK0000000003.json')).resolves.toMatchObject({data:{ok:true}});
  expect(fetchImpl).toHaveBeenCalledTimes(3);
  expect(delays).toEqual([1000,1000]);
 });

 it('does not retry before a Retry-After delay beyond the bounded request window',async()=>{
  const sleep=vi.fn(async()=>{});
  const fetchImpl=vi.fn(async()=>new Response('slow down',{status:429,headers:{'Retry-After':'120'}}));
  const client=createSecRequestClient({fetchImpl,minIntervalMs:0,identityProvider,sleep});
  await expect(client.json('https://data.sec.gov/submissions/CIK0000000098.json')).rejects.toMatchObject({category:'upstream_throttled'});
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(sleep).not.toHaveBeenCalled();
 });

 it('does not retry access-denied responses',async()=>{
  const fetchImpl=vi.fn(async()=>new Response('denied',{status:403}));
  const client=createSecRequestClient({fetchImpl,minIntervalMs:0,identityProvider});
  await expect(client.json('https://data.sec.gov/submissions/CIK0000000004.json')).rejects.toMatchObject({category:'upstream_access_denied',status:403});
  expect(fetchImpl).toHaveBeenCalledTimes(1);
 });

 it.each([
  [429,'upstream_throttled'],
  [503,'upstream_server_error']
 ])('categorizes exhausted HTTP %i responses as %s',async(status,category)=>{
  const fetchImpl=vi.fn(async()=>new Response('unavailable',{status}));
  const client=createSecRequestClient({fetchImpl,minIntervalMs:0,defaultMaxAttempts:1,identityProvider});
  await expect(client.json('https://data.sec.gov/submissions/CIK0000000099.json')).rejects.toMatchObject({category,status});
  expect(fetchImpl).toHaveBeenCalledTimes(1);
 });

 it('categorizes sandbox network denial without retrying or exposing its cause',async()=>{
  const denied=Object.assign(new TypeError('fetch failed for secret@example.org'),{cause:{code:'EACCES',message:'connect EACCES 203.0.113.9:443'}});
  const fetchImpl=vi.fn(async()=>{throw denied});
  const client=createSecRequestClient({fetchImpl,minIntervalMs:0,identityProvider});
  let observed:unknown;
  try{await client.json('https://data.sec.gov/submissions/CIK0000000005.json')}catch(error){observed=error}
  expect(observed).toBeInstanceOf(SecRequestError);
  expect(observed).toMatchObject({category:'network_access_denied',message:'SEC network access is unavailable in this server environment.'});
  expect(publicSecError(observed).error).not.toContain('secret@example.org');
  expect(fetchImpl).toHaveBeenCalledTimes(1);
 });

 it('retries timeouts only up to the configured bound',async()=>{
  const delays:number[]=[];
  const timeout=Object.assign(new Error('timed out'),{name:'TimeoutError'});
  const fetchImpl=vi.fn(async()=>{throw timeout});
  const client=createSecRequestClient({fetchImpl,minIntervalMs:0,defaultMaxAttempts:2,identityProvider,sleep:async(ms:number)=>{delays.push(ms)}});
  await expect(client.json('https://data.sec.gov/submissions/CIK0000000006.json')).rejects.toMatchObject({category:'timeout'});
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(delays).toEqual([500]);
 });

 it('rejects malformed successful JSON as an explicit upstream data failure',async()=>{
  const fetchImpl=vi.fn(async()=>new Response('{not-json',{status:200}));
  const client=createSecRequestClient({fetchImpl,minIntervalMs:0,identityProvider});
  await expect(client.json('https://data.sec.gov/submissions/CIK0000000007.json')).rejects.toMatchObject({category:'malformed_response'});
  expect(fetchImpl).toHaveBeenCalledTimes(1);
 });

 it('keeps the configured identity server-side while sending it on SEC requests',async()=>{
  let sentHeaders:HeadersInit|undefined;
  const fetchImpl=vi.fn(async(_url:string,init?:RequestInit)=>{sentHeaders=init?.headers;return jsonResponse({ok:true})});
  const client=createSecRequestClient({fetchImpl,minIntervalMs:0,identityProvider});
  await client.json('https://data.sec.gov/submissions/CIK0000000008.json');
  expect(new Headers(sentHeaders).get('User-Agent')).toBe(identityProvider());
  expect(publicSecError(new SecRequestError('configuration','safe message'))).toEqual({error:'safe message',errorCategory:'configuration'});
 });
});
