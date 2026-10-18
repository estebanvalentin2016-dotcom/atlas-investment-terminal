import {describe,expect,it} from 'vitest';
import {appendIndustryComparabilityLimitations,industryComparabilityLimitations,mapSecIndustry} from './industry-classification';
import {buildDiscoveryBriefing} from './discovery-briefing-model';
import {readDiscoveryBriefing,writeDiscoveryBriefing} from './discovery-briefing-storage';
import {defaultRankWeights,deriveRankingMetrics,rankCompanies,type SecCompany,type SecIndustryClassification} from './ranking-model';
import {initialAutonomousScreen} from './autonomous-screen';

const reported=(code:string,description='Reported industry'):SecIndustryClassification=>({
 status:'reported',system:'SEC SIC',code,description,
 source:'https://data.sec.gov/submissions/CIK0000000001.json',retrievedAt:'2026-10-18T12:00:00.000Z'
});
const unavailable:SecIndustryClassification={status:'unavailable',system:'SEC SIC',code:null,description:null,source:'https://data.sec.gov/submissions/CIK0000000001.json',retrievedAt:'2026-10-18T12:00:00.000Z',reason:'SEC unavailable'};
const annual=(year:number,value:number)=>({year,end:`${year}-12-31`,filed:`${year+1}-02-15`,form:'10-K',accession:'0000000001-26-000001',value});
const company=(classification?:SecIndustryClassification):SecCompany=>({ticker:'SAME',name:'Neutral Issuer Name',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json',retrievedAt:'2026-10-18T12:00:00.000Z',classification,metrics:[
 {name:'Revenue',values:[annual(2025,150),annual(2024,100)]},
 {name:'Operating cash flow',values:[annual(2025,35)]},
 {name:'Capital expenditures',values:[annual(2025,5)]},
 {name:'Net income',values:[annual(2025,20)]}
]});
const memoryStorage=():Storage=>{
 const entries=new Map<string,string>();
 return {get length(){return entries.size},clear(){entries.clear()},getItem:key=>entries.get(key)??null,key:index=>[...entries.keys()][index]??null,removeItem:key=>{entries.delete(key)},setItem:(key,value)=>{entries.set(key,value)}};
};

describe('SEC-backed industry classification',()=>{
 it('maps insurance carriers, brokers, banks, other valid SICs, and unavailable classifications',()=>{
  expect(mapSecIndustry(reported('6331','Fire, Marine & Casualty Insurance'))).toBe('insurance_carrier');
  expect(mapSecIndustry(reported('6411','Insurance Agents, Brokers & Service'))).toBe('insurance_broker_services');
  expect(mapSecIndustry(reported('6022','State Commercial Banks'))).toBe('bank');
  expect(mapSecIndustry(reported('3571','Electronic Computers'))).toBe('other_recognized_sic');
  expect(mapSecIndustry(unavailable)).toBe('unknown');
 });
 it('does not infer an industry from a company ticker or name',()=>{
  const suggestive={...company(),ticker:'BANKINS',name:'Insurance Bank Brokerage Corporation'};
  expect(mapSecIndustry(suggestive.classification)).toBe('unknown');
  expect(mapSecIndustry({...unavailable})).toBe('unknown');
 });
 it('generates source-aware specialized warnings only where supported',()=>{
  const carrier=industryComparabilityLimitations(reported('6331','Fire, Marine & Casualty Insurance'))[0];
  expect(carrier).toContain('SEC SIC 6331');
  expect(carrier).toContain('reserve adequacy');
  expect(carrier).toContain('https://data.sec.gov/submissions/');
  expect(industryComparabilityLimitations(reported('6411'))[0]).toContain('organic growth from acquisitions');
  expect(industryComparabilityLimitations(reported('6022'))[0]).toContain('regulatory capital');
  expect(industryComparabilityLimitations(unavailable)[0]).toContain('classification was unavailable');
  expect(industryComparabilityLimitations(reported('3571'))).toEqual([]);
 });
 it('does not change screening metrics, verdicts, scores, or ranking order',()=>{
  const before=company();
  const after=company(reported('6331'));
  expect(deriveRankingMetrics(after)).toEqual(deriveRankingMetrics(before));
  expect(initialAutonomousScreen(after,'2026-10-18')).toEqual(initialAutonomousScreen(before,'2026-10-18'));
  expect(rankCompanies([before,after],defaultRankWeights).map(x=>({ticker:x.ticker,score:x.score,metrics:x.metrics})))
   .toEqual(rankCompanies([before,company()],defaultRankWeights).map(x=>({ticker:x.ticker,score:x.score,metrics:x.metrics})));
 });
 it('persists source-backed limitations through the unchanged version 1 briefing contract',()=>{
  const limitations=appendIndustryComparabilityLimitations(['Price unavailable'],reported('6411','Insurance Agents, Brokers & Service'));
  const snapshot=buildDiscoveryBriefing({scanCompletedAt:'2026-10-18T12:00:00.000Z',issuersExamined:24,leads:[{
   ticker:'BRO',companyName:'Brown & Brown, Inc.',preliminaryScreenStatus:'preliminary_pass',revenueGrowth:12,fcfMargin:10,annualPe:25,
   emergingStrength:'not_improving',screeningReasons:['Preliminary financial screen passed'],evidenceLimitations:limitations
  }]});
  const storage=memoryStorage();
  writeDiscoveryBriefing(storage,snapshot);
  const restored=readDiscoveryBriefing(storage);
  expect(snapshot.version).toBe(1);
  expect(restored?.version).toBe(1);
  expect(restored?.leads[0].evidenceLimitations).toEqual(expect.arrayContaining([expect.stringContaining('SEC SIC 6411'), 'Price unavailable']));
 });
});
