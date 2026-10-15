import {describe,expect,it,vi} from 'vitest';
// @ts-ignore Node-only SEC institutional filings parser
import {select13FReports,parse13FInformationTable,compare13FHoldings,load13FManager,handleInstitutionalRequest} from '../server/institutional-api.mjs';
const xml=(entries:{issuer:string;cusip:string;shares:number;value:number;option?:string;type?:string}[])=>
 '<?xml version="1.0"?><informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">'+entries.map(e=>'<infoTable><nameOfIssuer>'+e.issuer+'</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>'+e.cusip+'</cusip><value>'+e.value+'</value><shrsOrPrnAmt><sshPrnamt>'+e.shares+'</sshPrnamt><sshPrnamtType>'+(e.type||'SH')+'</sshPrnamtType></shrsOrPrnAmt>'+(e.option?'<putCall>'+e.option+'</putCall>':'')+'</infoTable>').join('')+'</informationTable>';
const r=(form:string,period:string,filed:string,acc:string)=>({form,period,filed,accession:acc});
const secRecords=(records:{form:string;period:string;filed:string;accession:string}[])=>
 {return {filings:{recent:{form:records.map(r=>r.form),reportDate:records.map(r=>r.period),filingDate:records.map(r=>r.filed),accessionNumber:records.map(r=>r.accession)}}}};
describe('SEC 13F normalization and quarter end alignment',()=>{
 it('selects two distinct reporting quarters even when submissions data is unsorted',()=>{
  const submission=secRecords([
   r('13F-HR','2026-03-31','2026-05-15','0000902664-26-002526'),
   r('13F-HR','2026-06-30','2026-08-14','0000902664-26-004000'),
   r('8-K','2026-07-01','2026-07-01','0000902664-26-004001')
  ]);
  const result=select13FReports(submission);
  expect(result.issue).toBeNull();
  expect(result.reports.map((x:{period:string})=>x.period)).toEqual(['2026-06-30','2026-03-31']);
 });
 it('rejects amended 13F periods rather than mixing additional and restated tables',()=>{
  const submission=secRecords([
   r('13F-HR/A','2026-06-30','2026-08-19','0000902664-26-004099'),
   r('13F-HR','2026-06-30','2026-08-14','0000902664-26-004000'),
   r('13F-HR','2026-03-31','2026-05-15','0000902664-26-002526')
  ]);
  expect(select13FReports(submission).issue).toContain('amendment');
 });
 it('treats a 13F-NT notice as a manager relationship, not a zero-position portfolio',()=>{
  const submission=secRecords([r('13F-NT','2026-06-30','2026-08-14','0000902664-26-004000'),r('13F-HR','2026-03-31','2026-05-15','0000902664-26-002526')]);
  expect(select13FReports(submission).issue).toContain('notice');
 });
 it('extracts and consolidates share counts by exact CUSIP/class, excluding option and PRN rows',()=>{
  const result=parse13FInformationTable(xml([
   {issuer:'APPLE INC',cusip:'037833100',shares:100,value:15000},
   {issuer:'APPLE INC',cusip:'037833100',shares:50,value:7500},
   {issuer:'APPLE INC',cusip:'037833100',shares:10,value:8000,option:'CALL'},
   {issuer:'US TREASURY',cusip:'91282CKB6',shares:300,value:40000,type:'PRN'}
  ]));
  expect(result.rows).toBe(4);
  expect(result.excluded).toBe(2);
  expect(result.holdings).toHaveLength(1);
  expect(result.holdings[0]).toMatchObject({cusip:'037833100',shares:150,valueDollars:22500,rowCount:2});
 });
 it('measures new, growing, reduced and disappearing reported share positions without trade dates',()=>{
  const recent=parse13FInformationTable(xml([
   {issuer:'APPLE INC',cusip:'037833100',shares:150,value:30000},
   {issuer:'AMAZON COM INC',cusip:'023135106',shares:100,value:20000},
   {issuer:'META PLATFORMS',cusip:'30303M102',shares:20,value:4000},
   {issuer:'NVIDIA CORP',cusip:'67066G104',shares:15,value:9000}
  ])).holdings;
  const previous=parse13FInformationTable(xml([
   {issuer:'APPLE INC',cusip:'037833100',shares:100,value:10000},
   {issuer:'META PLATFORMS',cusip:'30303M102',shares:30,value:3000},
   {issuer:'NVIDIA CORP',cusip:'67066G104',shares:15,value:2000},
   {issuer:'MICROSOFT CORP',cusip:'594918104',shares:45,value:14000}
  ])).holdings;
  const rows=compare13FHoldings(recent,previous);
  expect(Object.fromEntries(rows.map((x:{issuer:string;change:string})=>[x.issuer,x.change]))).toEqual({
   'APPLE INC':'reported_increase','AMAZON COM INC':'newly_reported','META PLATFORMS':'reported_decrease',
   'NVIDIA CORP':'unchanged','MICROSOFT CORP':'no_longer_reported'
  });
  expect(rows.find((x:{issuer:string})=>x.issuer==='APPLE INC').changeShares).toBe(50);
  expect(rows.find((x:{issuer:string})=>x.issuer==='APPLE INC').portfolioPct).toBeGreaterThan(0);
  expect(rows.every((x:Record<string,unknown>)=>!('purchaseDate' in x))).toBe(true);
 });
 it('rejects invalid or dangerous XML declarations instead of trusting malformed position files',()=>{
  expect(()=>parse13FInformationTable('<informationTable><!DOCTYPE user><infoTable>text</infoTable></informationTable>')).toThrow();
  expect(()=>parse13FInformationTable('<form13F>not an info table</form13F>')).toThrow();
 });
});
describe('SEC institutional loader',()=>{
 it('loads complete 13F tables from canonical archive URLs with SEC user agent',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS test compliance team tests@example.org');
  const urls:string[]=[];
  const q2='0000902664-26-004000',q1='0000902664-26-002526';
  const sub=secRecords([r('13F-HR','2026-06-30','2026-08-14',q2),r('13F-HR','2026-03-31','2026-05-15',q1)]);
  const latest=xml([{issuer:'APPLE INC',cusip:'037833100',shares:200,value:45000}]);
  const previous=xml([{issuer:'APPLE INC',cusip:'037833100',shares:120,value:26000}]);
  vi.stubGlobal('fetch',vi.fn(async (url:string)=>{
   const u=String(url);urls.push(u);
   if(u.includes('/submissions/CIK'))return new Response(JSON.stringify({...sub,name:'Test Reporting Manager LP'}),{status:200});
   if(u.endsWith('/index.json'))return new Response(JSON.stringify({directory:{item:[{name:'primary_doc.xml'},{name:'infotable.xml'}]}}),{status:200});
   if(u.endsWith('/infotable.xml'))return new Response(u.includes('000090266426004000')?latest:previous,{status:200});
   throw Error('Unexpected SEC target: '+u);
  }));
  try{
   const result=await load13FManager('1743937');
   expect(result.manager).toBe('Test Reporting Manager LP');
   expect(result.submissionUrl).toBe('https://data.sec.gov/submissions/CIK0001743937.json');
   expect(result.rows[0].change).toBe('reported_increase');
   expect(result.rows[0].changeShares).toBe(80);
   expect(result.latest.period).toBe('2026-06-30');
   expect(result.latest.filed).toBe('2026-08-14');
   expect(result.latest.sourceUrl).toContain('infotable.xml');
   expect(urls).toHaveLength(5);
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
 });
 it('rejects invalid CIK before fetching any SEC data',async()=>{
  let code=0;
  await handleInstitutionalRequest({method:'GET',url:'/api/institutions/managers?cik=../../../evil'},{writeHead(c:number){code=c},end(){}});
  expect(code).toBe(400);
 });
 it('does not publish partial holdings when the SEC blocks the manager submission',async()=>{
  vi.stubEnv('SEC_USER_AGENT','ATLAS tests tests@example.org');
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('Access blocked',{status:403})));
  let code=0,body='';
  try{
   await handleInstitutionalRequest({method:'GET',url:'/api/institutions/managers?cik=1418814'},{writeHead(c:number){code=c},end(s:string){body=s}});
   expect(code).toBe(503);
   expect(JSON.parse(body).coverage).toContain('No holdings comparison');
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
 });
});
