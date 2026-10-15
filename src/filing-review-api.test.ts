import {describe,expect,it,vi} from 'vitest';
// @ts-ignore Node-only SEC filing review adapter
import {permittedFilingUrl,extractFilingText,assessFilingEvidence,handleFilingReview} from '../server/filing-review-api.mjs';
describe('SEC source evidence review',()=>{
 const url='https://www.sec.gov/Archives/edgar/data/1819994/0001819994-26-000067.txt';
 it('accepts canonical SEC archive URLs and rejects other hosts, queries and unsupported paths',()=>{
  expect(permittedFilingUrl(url)).toBe(url);
  expect(permittedFilingUrl('https://evil.example/Archives/edgar/data/1819994/f.txt')).toBeNull();
  expect(permittedFilingUrl(url+'?redirect=1')).toBeNull();
  expect(permittedFilingUrl('https://www.sec.gov/Archives/edgar/data/1819994/not-pdf.pdf')).toBeNull();
 });
 it('extracts text from a main 8-K document with markup safely stripped',()=>{
  const raw='<DOCUMENT><TYPE>8-K\n<TEXT><html><script>fake contract secured</script><body>The issuer raises annual guidance.</body></html></TEXT></DOCUMENT>';
  const text=extractFilingText(raw);
  expect(text).toContain('raises annual guidance');
  expect(text).not.toContain('fake contract secured');
 });
 it('flags qualifying phrases as review candidates, never verified buy signals',()=>{
  const result=assessFilingEvidence('The company raises full-year guidance and was awarded a contract.');
  expect(result.status).toBe('potential_language');
  expect(result.potential.length).toBeGreaterThan(0);
  expect(result.limitations).toContain('no bullish conclusion');
 });
 it('keeps negative guidance caution separate from possible positives',()=>{
  const result=assessFilingEvidence('The company raises full-year guidance. It also lowered earnings outlook.');
  expect(result.status).toBe('mixed_claims');
  expect(result.cautions.length).toBe(1);
 });
 it('treats absence of keywords as unknown rather than bearish',()=>{
  const result=assessFilingEvidence('The board appointed a new independent director.');
  expect(result.status).toBe('no_positive_phrase_detected');
  expect(result.potential).toEqual([]);
 });
 it('rejects unsafe review URLs at the API boundary',async()=>{
  let code=0,body='';
  await handleFilingReview({url:'/api/opportunities/review?url='+encodeURIComponent('https://elsewhere.example/filing.txt'),method:'GET'},{writeHead(c:number){code=c},end(v:string){body=v}});
  expect(code).toBe(400);expect(JSON.parse(body).error).toContain('valid SEC');
 });
 it('handles SEC access restrictions without fabricating classification',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS tests tests@example.com');
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('Access denied',{status:403})));
  let code=0,body='';
  try{
   await handleFilingReview({url:'/api/opportunities/review?url='+encodeURIComponent(url),method:'GET'},{writeHead(c:number){code=c},end(v:string){body=v}});
   const result=JSON.parse(body);
   expect(code).toBe(200);
   expect(result.sourceStatus).toBe('unavailable');
   expect(result.evidence).toBeNull();
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
 });
 it('reports extracted evidence when a valid filing is accessible',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS tests tests@example.com');
  const other='https://www.sec.gov/Archives/edgar/data/1819994/0001819994-26-000099.txt';
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('The company raises annual guidance.',{status:200,headers:{'Content-Type':'text/plain'}})));
  let code=0,body='';
  try{
   await handleFilingReview({url:'/api/opportunities/review?url='+encodeURIComponent(other),method:'GET'},{writeHead(c:number){code=c},end(v:string){body=v}});
   const result=JSON.parse(body);
   expect(code).toBe(200);
   expect(result.sourceStatus).toBe('reviewed_text');
   expect(result.evidence.status).toBe('potential_language');
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
 });
});
