import {describe,it,expect,vi} from 'vitest';
// @ts-ignore Node-only SEC index parser
import {parseMasterIndex,rankFreshFilings,handleWideDiscovery,recentSubmissions} from '../server/opportunity-wide-api.mjs';
describe('market-wide SEC filing discovery',()=>{
 const tickers=[{cik_str:1535527,ticker:'CRWD',title:'CrowdStrike Holdings'}];
 const line='1535527|CrowdStrike Holdings|8-K|2026-10-14|edgar/data/1535527/0001535527-26-000029.txt';
 const index=(...lines:string[])=>['CIK|Company Name|Form Type|Date Filed|Filename',...lines].join('\n');
 it('matches SEC daily index filings with public ticker identities',()=>{const rows=parseMasterIndex(index(line),'2026-10-14',tickers);expect(rows).toHaveLength(1);expect(rows[0].ticker).toBe('CRWD');expect(rows[0].url).toContain('/Archives/edgar/data/')});
 it('excludes unrelated, unlisted and misdated entries',()=>{const rows=parseMasterIndex(index(line,'123456|Other|8-K|2026-10-14|edgar/data/123456/x.txt','1535527|CrowdStrike|10-Q|2026-10-14|edgar/data/1535527/x.txt'),'2026-10-15',tickers);expect(rows).toEqual([])});
 it('deduplicates and orders the newest filings first',()=>{const a=parseMasterIndex(index(line),'2026-10-14',tickers)[0];const b={...a,filed:'2026-10-15',url:a.url+'b'};expect(rankFreshFilings([a,a,b]).map((x:{filed:string})=>x.filed)).toEqual(['2026-10-15','2026-10-14'])});
 it('parses real master index padding around form and issuer fields',()=>{const padded='1535527|CrowdStrike Holdings             |8-K     |2026-10-14|edgar/data/1535527/0001535527-26-000029.txt';expect(parseMasterIndex(index(padded),'2026-10-14',tickers)).toHaveLength(1)});
 it('rejects responses lacking a recognizable SEC index header',()=>expect(()=>parseMasterIndex('<html>Access denied</html>','2026-10-14',tickers)).toThrow('Unrecognized SEC master index header'));
 it('extracts recent 8-K fallback rows without inventing bullishness',()=>{const rows=recentSubmissions({cik:1535527,name:'CrowdStrike',filings:{recent:{form:['8-K','10-Q'],filingDate:['2026-10-14','2026-10-14'],accessionNumber:['0001535527-26-000029','0001535527-26-000030']}}},'CRWD',Date.parse('2026-10-15T12:00:00Z'));expect(rows).toHaveLength(1);expect(rows[0].url).toContain('000153552726000029')});
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
  }finally{
   vi.unstubAllGlobals();
   vi.unstubAllEnvs();
  }
 });
 it('ignores unrelated routes',async()=>expect(await handleWideDiscovery({url:'/api/other'},{})).toBe(false));
});
