import {describe,expect,it,vi} from 'vitest';
// @ts-ignore Node-only SEC filing review adapter
import {permittedFilingUrl,extractFilingText,assessFilingEvidence,handleFilingReview,readBoundedFiling,parseArchiveFiling,selectFilingDocuments,researchFilingContext} from '../server/filing-review-api.mjs';
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
 it('validates accession paths for direct SEC master-index and company-submissions URLs',()=>{
  const master=parseArchiveFiling('https://www.sec.gov/Archives/edgar/data/2012383/0001193125-26-420979.txt');
  expect(master?.root).toBe('https://www.sec.gov/Archives/edgar/data/2012383/000119312526420979/');
  const submission=parseArchiveFiling('https://www.sec.gov/Archives/edgar/data/2012383/000119312526420979/0001193125-26-420979.txt');
  expect(submission?.accession).toBe('0001193125-26-420979');
  expect(parseArchiveFiling('https://www.sec.gov/Archives/edgar/data/2012383/00011931250000000000/0001193125-26-420979.txt')).toBeNull();
 });
 it('selects a verified primary 8-K and familiar SEC Exhibit 99 naming variants',()=>{
  const meta={filings:{recent:{accessionNumber:['0001193125-26-420979'],form:['8-K'],primaryDocument:['d100d8k.htm']}}};
  const index={directory:{item:[{name:'d100d8k.htm'},{name:'d100dex991.htm'},{name:'ex99_2.htm'},{name:'cover.jpg'}]}};
  const selection=selectFilingDocuments(meta,index,'0001193125-26-420979');
  expect(selection.documents.map((x:{name:string})=>x.name)).toEqual(['d100d8k.htm','d100dex991.htm','ex99_2.htm']);
  expect(selection.primaryLocated).toBe(true);
  expect(selection.selectedExhibits).toBe(2);
 });
 it('retrieves primary 8-K and Exhibit 99 language as attributed source documents',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS tests tests@example.com');
  const other='https://www.sec.gov/Archives/edgar/data/2012383/0001193125-26-420979.txt';
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async (request:string)=>{
   const target=String(request);calls.push(target);
   if(target.includes('/submissions/CIK'))return new Response(JSON.stringify({filings:{recent:{accessionNumber:['0001193125-26-420979'],form:['8-K'],primaryDocument:['d100d8k.htm']}}}),{status:200});
   if(target.endsWith('/index.json'))return new Response(JSON.stringify({directory:{item:[{name:'d100d8k.htm'},{name:'d100dex991.htm'}]}}),{status:200});
   if(target.endsWith('/d100d8k.htm'))return new Response('<html>Item 2.02. Results of Operations and Financial Condition. The company furnished its earnings release as Exhibit 99.1.</html>',{status:200});
   if(target.endsWith('/d100dex991.htm'))return new Response('<html>The company raises full-year guidance. 19% increase in revenue year-over-year. $205 billion of net inflows this quarter.</html>',{status:200});
   throw Error('Unexpected target: '+target);
  }));
  let code=0,body='';
  try{
   await handleFilingReview({url:'/api/opportunities/review?url='+encodeURIComponent(other),method:'GET'},{writeHead(c:number){code=c},end(v:string){body=v}});
   const result=JSON.parse(body);
   expect(code).toBe(200);
   expect(result.reviewMethod).toBe('selected_documents');
   expect(result.sourceStatus).toBe('partial_text');
   expect(result.documents).toHaveLength(2);
   expect(result.evidence.potential[0].sourceName).toBe('d100dex991.htm');
   expect(result.evidence.topics.map((x:{code:string})=>x.code)).toContain('2.02');
   expect(result.evidence.metrics.map((x:{reportedValue:string})=>x.reportedValue)).toContain('19% increase in revenue');
   expect(result.evidence.metrics[0].sourceUrl).toContain('/d100dex991.htm');
   expect(result.evidence.potential[0].sourceUrl).toContain('/d100dex991.htm');
   expect(calls).not.toContain(other); // no 4.99 MB combined download
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
 });
 it('extracts Q3 2026 BlackRock-style operating figures without inventing an earnings beat',()=>{
  const release='BlackRock Reports Third Quarter 2026. $15.5 trillion in AUM following $869 billion of net inflows over the last twelve months. $205 billion of net inflows this quarter. 19% increase in revenue year-over-year. 38% increase in year-over-year as adjusted diluted EPS.';
  const report=researchFilingContext(release);
  const values=report.metrics.map((m:{reportedValue:string})=>m.reportedValue);
  expect(values).toContain('$15.5 trillion in AUM');
  expect(values).toContain('$205 billion of net inflows');
  expect(values).toContain('$869 billion of net inflows');
  expect(values).toContain('19% increase in revenue');
  expect(values).toContain('38% increase in year-over-year as adjusted diluted EPS');
  expect(assessFilingEvidence(release).status).toBe('no_positive_phrase_detected');
 });
 it('extracts reported revenue/EPS declines and cash outflows without calling them positive',()=>{
  const report=researchFilingContext('13% decrease in revenue. 8% decline in adjusted diluted EPS. $25 billion of net outflows.');
  expect(report.metrics.map((m:{label:string})=>m.label)).toEqual(['Reported revenue growth','Reported EPS growth','Reported net outflows']);
  expect(report.metrics[0].reportedValue).toBe('13% decrease in revenue');
 });
 it('recognizes 8-K event subjects separately from operating performance',()=>{
  const report=researchFilingContext('Item 2.02. Results of Operations and Financial Condition. Item 7.01. Regulation FD Disclosure. Item 9.01. Financial Statements and Exhibits.');
  expect(report.topics.map((x:{code:string})=>x.code)).toEqual(['2.02','7.01','9.01']);
  expect(report.metrics).toHaveLength(0);
 });
 it('does not infer metrics or direction from unrelated administrative text',()=>{
  const report=researchFilingContext('The board appointed a director. Form 8-K. No operating metrics were provided.');
  expect(report.metrics).toEqual([]);
  expect(report.topics).toEqual([]);
 });
 it('reads only a bounded prefix when SEC declares an oversized full submission',async()=>{
  const raw='<SEC-DOCUMENT><DOCUMENT><TYPE>8-K\n<TEXT>The company raises annual guidance.</TEXT></DOCUMENT>'+'z'.repeat(120);
  const response=new Response(raw,{headers:{'content-length':'5000000'}});
  const extracted=await readBoundedFiling(response,120);
  expect(extracted.truncated).toBe(true);
  expect(extracted.declaredBytes).toBe(5000000);
  expect(extracted.bytesRead).toBe(120);
  expect(extracted.text.length).toBe(120);
  expect(extracted.text).toContain('raises annual guidance');
 });
 it('reads normal complete filings without falsely declaring partial coverage',async()=>{
  const content='<SEC-DOCUMENT><DOCUMENT><TYPE>8-K\n<TEXT>Ordinary corporate disclosure.</TEXT></DOCUMENT>';
  const result=await readBoundedFiling(new Response(content),200);
  expect(result.truncated).toBe(false);
  expect(result.declaredBytes).toBeNull();
  expect(result.bytesRead).toBe(new TextEncoder().encode(content).byteLength);
 });
 it('does not classify large filings as inaccessible when a valid initial 8-K section was read',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS tests tests@example.com');
  const other='https://www.sec.gov/Archives/edgar/data/1819994/0001819994-26-000102.txt';
  const content='<SEC-DOCUMENT><DOCUMENT><TYPE>8-K\n<TEXT>The company raises annual guidance.</TEXT></DOCUMENT>';
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(content,{status:200,headers:{'content-length':'5000000'}})));
  let code=0,body='';
  try{
   await handleFilingReview({url:'/api/opportunities/review?url='+encodeURIComponent(other),method:'GET'},{writeHead(c:number){code=c},end(v:string){body=v}});
   const result=JSON.parse(body);
   expect(code).toBe(200);
   expect(result.sourceStatus).toBe('partial_text');
   expect(result.evidence.status).toBe('potential_language');
   expect(result.note).toContain('Partial review only');
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
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
 it('does not classify successful HTTP responses that are not recognizable SEC filings',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS tests tests@example.com');
  const other='https://www.sec.gov/Archives/edgar/data/1819994/0001819994-26-000101.txt';
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('<html>Access problem</html>',{status:200})));
  let code=0,body='';
  try{
   await handleFilingReview({url:'/api/opportunities/review?url='+encodeURIComponent(other),method:'GET'},{writeHead(c:number){code=c},end(v:string){body=v}});
   const result=JSON.parse(body);
   expect(code).toBe(200);
   expect(result.sourceStatus).toBe('unavailable');
   expect(result.evidence).toBeNull();
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
 });
 it('reports extracted evidence when a valid filing is accessible',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS tests tests@example.com');
  const other='https://www.sec.gov/Archives/edgar/data/1819994/0001819994-26-000099.txt';
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('<SEC-DOCUMENT>0001819994-26-000099\n<DOCUMENT><TYPE>8-K\n<TEXT>The company raises annual guidance.</TEXT></DOCUMENT>',{status:200,headers:{'Content-Type':'text/plain'}})));
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
