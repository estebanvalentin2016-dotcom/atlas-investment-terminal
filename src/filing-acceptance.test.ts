import {describe,it,expect,vi} from 'vitest';
// @ts-ignore Node-only SGML acceptance adapter
import {extractSecAcceptanceHeader,handleFilingAcceptanceRequest} from '../server/filing-acceptance-api.mjs';
const accepted=(value:string,acc='0001193125-26-420979')=>'<SEC-DOCUMENT>'+acc+'\n<SEC-HEADER>\nACCESSION NUMBER: '+acc+'\n<ACCEPTANCE-DATETIME>'+value+'\n</SEC-HEADER>\n<DOCUMENT><TYPE>8-K\n';
const filing='https://www.sec.gov/Archives/edgar/data/2012383/0001193125-26-420979.txt';
describe('EDGAR raw-header acceptance clock',()=>{
 it('reads strict Eastern-local SGML 14 digit acceptance datetime without converting ambiguous JSON',()=>{
  const x=extractSecAcceptanceHeader(accepted('20261014163005'),'0001193125-26-420979');
  expect(x.acceptedEasternClock).toBe('2026-10-14 16:30:05 ET');
  expect(x.sessionWindow).toBe('after_regular_close');
  expect(x.firstPublicReleaseVerified).toBe(false);
 });
 it('classifies before-open, during-session and 4pm boundary as distinct',()=>{
  expect(extractSecAcceptanceHeader(accepted('20261014092500'),'0001193125-26-420979').sessionWindow).toBe('before_regular_open');
  expect(extractSecAcceptanceHeader(accepted('20261014155959'),'0001193125-26-420979').sessionWindow).toBe('during_regular_session');
  expect(extractSecAcceptanceHeader(accepted('20261014160000'),'0001193125-26-420979').sessionWindow).toBe('after_regular_close');
 });
 it('rejects fabricated acceptance dates and invalid local times',()=>{
  expect(extractSecAcceptanceHeader(accepted('20260230160000'),'0001193125-26-420979')).toBeNull();
  expect(extractSecAcceptanceHeader(accepted('20261014246000'),'0001193125-26-420979')).toBeNull();
  expect(extractSecAcceptanceHeader(accepted('20261014166099'),'0001193125-26-420979')).toBeNull();
 });
 it('rejects headers without an explicit matching accession identifier',()=>{
  expect(extractSecAcceptanceHeader('<SEC-HEADER>\\n<ACCEPTANCE-DATETIME>20261014163005\\n</SEC-HEADER>','0001193125-26-420979')).toBeNull();
 });
 it('does not accept a mismatched accession header',()=>{
  expect(extractSecAcceptanceHeader(accepted('20261014160000','0001193125-26-000010'),'0001193125-26-420979')).toBeNull();
 });
 it('does not accept injected timestamps outside the top-level SEC header',()=>{
  expect(extractSecAcceptanceHeader('<DOCUMENT><ACCEPTANCE-DATETIME>20261014160000</DOCUMENT>','0001193125-26-420979')).toBeNull();
  expect(extractSecAcceptanceHeader('<SEC-HEADER>\n</SEC-HEADER>\n<DOCUMENT><ACCEPTANCE-DATETIME>20261014160000</DOCUMENT>','0001193125-26-420979')).toBeNull();
 });
 it('rejects unsafe source hosts without issuing an upstream request',async()=>{
  let code=0;
  await handleFilingAcceptanceRequest({method:'GET',url:'/api/opportunities/acceptance?url='+encodeURIComponent('https://example.net/filing.txt')},{writeHead(c:number){code=c},end(){}});
  expect(code).toBe(400);
 });
 it('returns verified header time with direct upstream fetch',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS tests tests@example.com');
  const seen:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async (u:string)=>{seen.push(String(u));return new Response(accepted('20261014163005'),{status:200,headers:{'content-length':'5000000'}})}));
  let status=0,body='';
  try{
   await handleFilingAcceptanceRequest({method:'GET',url:'/api/opportunities/acceptance?url='+encodeURIComponent(filing)},{writeHead(c:number){status=c},end(s:string){body=s}});
   const result=JSON.parse(body);
   expect(status).toBe(200);
   expect(result.sourceStatus).toBe('verified_header');
   expect(result.accepted.sessionWindow).toBe('after_regular_close');
   expect(seen).toEqual([filing]);
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
 });
 it('returns unavailable rather than guessing a time when the SEC rejects access',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS tests tests@example.com');
  const other='https://www.sec.gov/Archives/edgar/data/2012383/0001193125-26-420980.txt';
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('Blocked',{status:403})));
  let body='';
  try{
   await handleFilingAcceptanceRequest({method:'GET',url:'/api/opportunities/acceptance?url='+encodeURIComponent(other)},{writeHead(){},end(s:string){body=s}});
   const result=JSON.parse(body);
   expect(result.sourceStatus).toBe('unavailable');
   expect(result.accepted).toBeNull();
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
 });
});
