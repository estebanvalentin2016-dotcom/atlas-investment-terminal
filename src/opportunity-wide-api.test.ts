import {describe,it,expect,vi} from 'vitest';
// @ts-ignore Node-only SEC index parser
import {parseMasterIndex,rankFreshFilings,handleWideDiscovery,recentSubmissions,summarizeSubmissions,decodeIndexBytes,diagnoseMasterIndex,normalizeSecDate} from '../server/opportunity-wide-api.mjs';
describe('market-wide SEC filing discovery',()=>{
 const tickers=[{cik_str:1535527,ticker:'CRWD',title:'CrowdStrike Holdings'}];
 const line='1535527|CrowdStrike Holdings|8-K|2026-10-14|edgar/data/1535527/0001535527-26-000029.txt';
 const index=(...lines:string[])=>['CIK|Company Name|Form Type|Date Filed|Filename',...lines].join('\n');
 it('matches SEC daily index filings with public ticker identities',()=>{const rows=parseMasterIndex(index(line),'2026-10-14',tickers);expect(rows).toHaveLength(1);expect(rows[0].ticker).toBe('CRWD');expect(rows[0].url).toContain('/Archives/edgar/data/')});
 it('distinguishes dissemination date from filed date and excludes unlisted or unrelated forms',()=>{const rows=parseMasterIndex(index(line,'123456|Other|8-K|2026-10-14|edgar/data/123456/x.txt','1535527|CrowdStrike|10-Q|2026-10-14|edgar/data/1535527/x.txt'),'2026-10-15',tickers);expect(rows).toHaveLength(1);expect(rows[0].filed).toBe('2026-10-14');expect(rows[0].discoveredOn).toBe('2026-10-15')});
 it('deduplicates and orders the newest filings first',()=>{const a=parseMasterIndex(index(line),'2026-10-14',tickers)[0];const b={...a,filed:'2026-10-15',url:a.url+'b'};expect(rankFreshFilings([a,a,b]).map((x:{filed:string})=>x.filed)).toEqual(['2026-10-15','2026-10-14'])});
 it('parses real master index padding around form and issuer fields',()=>{const padded='1535527|CrowdStrike Holdings             |8-K     |2026-10-14|edgar/data/1535527/0001535527-26-000029.txt';expect(parseMasterIndex(index(padded),'2026-10-14',tickers)).toHaveLength(1)});
 it('rejects responses lacking a recognizable SEC index header',()=>expect(()=>parseMasterIndex('<html>Access denied</html>','2026-10-14',tickers)).toThrow('Unrecognized SEC master index content'));
 it('decodes raw octet-stream text before parsing',()=>{const raw=index(line);const decoded=decodeIndexBytes(new TextEncoder().encode(raw));expect(decoded.encoding).toBe('utf-8');expect(parseMasterIndex(decoded.text,'2026-10-14',tickers)).toHaveLength(1)});
 it('parses headerless SEC master records but rejects unrelated HTML',()=>{expect(parseMasterIndex(line,'2026-10-14',tickers)).toHaveLength(1);expect(()=>parseMasterIndex('<html>Access denied</html>','2026-10-14',tickers)).toThrow()});
 it('separates raw 8-K counts from ticker-matched, valid indexed leads',()=>{
  const raw=index(line,'7654321|Private Example|8-K|2026-10-14|edgar/data/7654321/abc.txt','1535527|CrowdStrike|10-Q|2026-10-14|edgar/data/1535527/report.txt');
  const audit=diagnoseMasterIndex(raw,tickers);
  expect(audit.records).toBe(3);
  expect(audit.eightKRows).toBe(2);
  expect(audit.validEightKPaths).toBe(2);
  expect(audit.tickerMatchedEightK).toBe(1);
  expect(audit.samples[0].mappedTicker).toBe('CRWD');
 });
 it('reports malformed 8-K paths separately from raw event counts',()=>{
  const audit=diagnoseMasterIndex(index('1535527|CrowdStrike|8-K|2026-10-14|not-an-edgar-path'),tickers);
  expect(audit.eightKRows).toBe(1);
  expect(audit.validEightKPaths).toBe(0);
  expect(audit.tickerMatchedEightK).toBe(1);
 });
 it('normalizes actual SEC YYYYMMDD dates and validates impossible calendar dates',()=>{
  expect(normalizeSecDate('20261014')).toBe('2026-10-14');
  expect(normalizeSecDate('2026-10-14')).toBe('2026-10-14');
  expect(normalizeSecDate('20260230')).toBeNull();
  expect(normalizeSecDate('2026-13-14')).toBeNull();
 });
 it('preserves real dates and reduces unmatched-date diagnostics on compact SEC records',()=>{
  const compact='1535527|CrowdStrike|8-K|20261014|edgar/data/1535527/0001535527-26-000029.txt';
  const parsed=parseMasterIndex(index(compact),'2026-10-14',tickers);
  expect(parsed[0].filed).toBe('2026-10-14');
  expect(diagnoseMasterIndex(index(compact),tickers).undatedEightK).toBe(0);
 });
 it('returns more than 40 unique indexed filing candidates when requested',()=>{
  const many=Array.from({length:50},(_,i)=>({ticker:'T'+i,url:'https://www.sec.gov/Archives/edgar/data/1535527/'+i+'.txt',filed:'2026-10-14',discoveredOn:'2026-10-14'}));
  expect(rankFreshFilings(many,1200)).toHaveLength(50);
  expect(rankFreshFilings(many)).toHaveLength(40);
 });
 it('keeps ticker-matched 8-Ks when raw filing dates are not ISO formatted',()=>{
  const odd='1535527|CrowdStrike|8-K|10/14/2026|edgar/data/1535527/0001535527-26-000029.txt';
  const rows=parseMasterIndex(index(odd),'2026-10-14',tickers);
  expect(rows).toHaveLength(1);
  expect(rows[0].filed).toBeNull();
  expect(rows[0].discoveredOn).toBe('2026-10-14');
  expect(rankFreshFilings(rows)).toHaveLength(1);
 });
 it('keeps audit and parser consistent when raw filing dates are unusable',()=>{
  const odd='1535527|CrowdStrike|8-K|NA|edgar/data/1535527/0001535527-26-000029.txt';
  const audit=diagnoseMasterIndex(index(odd),tickers);
  expect(audit.undatedEightK).toBe(1);
  expect(audit.samples[0].filedRaw).toBe('NA');
  expect(audit.tickerMatchedEightK).toBe(1);
  expect(parseMasterIndex(index(odd),'2026-10-14',tickers)).toHaveLength(1);
 });
 it('extracts recent 8-K fallback rows without inventing bullishness',()=>{const rows=recentSubmissions({cik:1535527,name:'CrowdStrike',filings:{recent:{form:['8-K','10-Q'],filingDate:['2026-10-14','2026-10-14'],accessionNumber:['0001535527-26-000029','0001535527-26-000030']}}},'CRWD',Date.parse('2026-10-15T12:00:00Z'));expect(rows).toHaveLength(1);expect(rows[0].url).toContain('000153552726000029')});
 it('reports stale fallback dates explicitly instead of classifying them as zero-market opportunities',()=>{
  const data={cik:1535527,filings:{recent:{form:['10-Q','8-K'],filingDate:['2026-09-29','2026-09-10'],accessionNumber:['0001535527-26-000030','0001535527-26-000029']}}};
  const audit=summarizeSubmissions(data,'CRWD',Date.parse('2026-10-15T12:00:00Z'));
  expect(audit.latestFiling).toBe('2026-09-29');
  expect(audit.latest8K).toBe('2026-09-10');
  expect(audit.matchingRecent8K).toBe(0);
 });
 it('returns diagnostics and fallback results without a runtime error',async()=>{
  vi.stubEnv('SEC_USER_AGENT','Atlas test atlas-test@example.com');
  const day=new Date().toISOString().slice(0,10);
  vi.stubGlobal('fetch',vi.fn(async (url:string|URL)=>{
   const target=String(url);
   if(target.includes('company_tickers.json'))return new Response(JSON.stringify({'0':{cik_str:1535527,ticker:'CRWD',title:'CrowdStrike Holdings'}}),{status:200});
   if(target.includes('/daily-index/'))return new Response('CIK|Company Name|Form Type|Date Filed|Filename\\n',{status:200});
   if(target.includes('/submissions/CIK0001535527.json'))return new Response(JSON.stringify({cik:1535527,name:'CrowdStrike Holdings',filings:{recent:{form:['8-K'],filingDate:[day],accessionNumber:['0001535527-26-000029']}}}),{status:200});
   throw new Error('Unexpected URL '+target);
  }));
  let status=0;
  let payload='';
  const res={writeHead(code:number){status=code},end(value:string){payload=value}};
  try{
   expect(await handleWideDiscovery({url:'/api/opportunities/sec-wide',method:'GET'},res)).toBe(true);
   expect(status).toBe(200);
   const data=JSON.parse(payload);
   expect(data.diagnostics.length).toBeGreaterThan(0);
   expect(data.fallbackChecked).toBe(1);
   expect(data.rows[0].ticker).toBe('CRWD');
   expect(data.fallbackDiagnostics[0].ticker).toBe('CRWD');
  }finally{
   vi.unstubAllGlobals();
   vi.unstubAllEnvs();
  }
 });
 it('ignores unrelated routes',async()=>expect(await handleWideDiscovery({url:'/api/other'},{})).toBe(false));
});
