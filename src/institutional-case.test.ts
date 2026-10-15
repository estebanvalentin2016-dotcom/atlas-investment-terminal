import {describe,it,expect,vi} from 'vitest';
// @ts-ignore Node-only official SEC case validation
import {verifyValueActCase,HISTORICAL_VALUEACT} from '../server/institutional-case-api.mjs';
// @ts-ignore Node-only 13F primary reporting manager relationship extractor
import {parse13FCoverage} from '../server/institutional-api.mjs';
const h=HISTORICAL_VALUEACT;
function table(later:boolean,modified=false){
 const rows=h.expected.map((item:{issuer:string;key:string;earlier:number;later:number},i:number)=>{
  const count=later?item.later:item.earlier,shares=modified&&later&&i===0?count+1:count;
  const [cusip,className]=item.key.split('|');
  return '<infoTable><nameOfIssuer>'+item.issuer+'</nameOfIssuer><titleOfClass>'+className+'</titleOfClass><cusip>'+cusip+'</cusip><value>100000000</value><shrsOrPrnAmt><sshPrnamt>'+shares+'</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable>';
 });
 return '<informationTable>'+rows.join('')+'</informationTable>';
}
const cover='<edgarSubmission><reportType>13F COMBINATION REPORT</reportType><otherManagersInfo><otherManager><cik>0001351069</cik><name>ValueAct Capital Management, L.P.</name></otherManager></otherManagersInfo></edgarSubmission>';
function setup(mutated=false){
 vi.stubEnv('SEC_USER_AGENT','ATLAS testing sec-team@example.com');
 const seen:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async (url:string)=>{
  const u=String(url);seen.push(u);
  const later=u.includes('000141881426000003');
  if(u.endsWith('/index.json'))return new Response(JSON.stringify({directory:{item:[{name:'primary_doc.xml'},{name:later?'vac13f81426.xml':'vac13f51526.xml'}]}}));
  if(u.endsWith('/primary_doc.xml'))return new Response(cover,{status:200});
  if(u.endsWith('.xml'))return new Response(table(later,mutated),{status:200});
  throw Error('Unexpected SEC path '+u);
 }));
 return seen;
}
describe('Source-audited historical ValueAct position case',()=>{
 it('matches real source-observed Q1 and Q2 2026 Rocket, BLK, MDB and Roblox reported shares',async()=>{
  const seen=setup();
  try{
   const report=await verifyValueActCase({refresh:true});
   expect(report.status).toBe('verified_against_live_sec');
   expect(report.checks).toHaveLength(4);
   expect(report.checks.every((r:{checked:boolean})=>r.checked)).toBe(true);
   const rocket=report.checks.find((r:{ticker:string})=>r.ticker==='RKT');
   expect(rocket).toMatchObject({priorReported:28214724,latestReported:41668774,delta:13454050});
   const blk=report.checks.find((r:{ticker:string})=>r.ticker==='BLK');
   expect(blk).toMatchObject({priorReported:546100,latestReported:581700,delta:35600});
   expect(report.sources.latest.filed).toBe('2026-08-14');
   expect(report.sources.previous.filed).toBe('2026-05-15');
   expect(report.managerAffiliation.otherIncludedManager.cik).toBe('1351069');
   expect(report.managerAffiliation.reportType).toBe('13F COMBINATION REPORT');
   expect(seen.some(u=>u.endsWith('vac13f81426.xml'))).toBe(true);
   expect(seen.some(u=>u.endsWith('vac13f51526.xml'))).toBe(true);
   expect(seen.some(u=>u.endsWith('/primary_doc.xml'))).toBe(true);
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
 });
 it('does not verify a doctored source value even if all other holdings match',async()=>{
  setup(true);
  try{
   const report=await verifyValueActCase({refresh:true});
   expect(report.status).toBe('verification_incomplete');
   expect(report.checks.find((r:{ticker:string})=>r.ticker==='RKT').checked).toBe(false);
  }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
 });
 it('will not count a combination report as an independent second active manager',()=>{
  const data=parse13FCoverage(cover);
  expect(data.reportType).toBe('13F COMBINATION REPORT');
  expect(data.otherIncludedManagers).toEqual([{cik:'1351069',name:'ValueAct Capital Management, L.P.'}]);
  expect(data.reportCompleteness).toContain('COMBINATION');
 });
});
