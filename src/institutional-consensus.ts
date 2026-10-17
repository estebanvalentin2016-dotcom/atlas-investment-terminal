// Shared point-in-time security-level institutional consensus model.
// Only fully sourced active mandates with verified independent manager families
// count toward active consensus; 13F owner names alone do NOT prove independence.
export type ManagerStrategy='verified_active'|'verified_passive'|'unknown';
export type InstitutionRecord={
 managerCik:string;managerName:string;familyId:string|null;independenceEvidence:string|null;
 strategy:ManagerStrategy;strategyEvidence:string|null;
 asOfDate:string;publishedDate:string;sourceUrl:string;kind:'13f'|'fund';
 fundId:string|null;disclosureFrequency:'quarterly'|'monthly'|'daily';
 key:string;cusip:string;issuer:string;className:string;
 shares:number;priorShares:number|null;weightPct:number|null;
 change:'newly_reported'|'reported_increase'|'reported_decrease'|'unchanged'|'no_longer_reported';
};
export type ConsensusRow={
 key:string;cusip:string;issuer:string;className:string;asOfDate:string;
 reportedManagers:number;verifiedActiveFamilies:number;passiveFamilies:number;unclassifiedManagers:number;
 activeEmergingFamilies:number;provisionalInterest:number;signal:'verified_active_convergence'|'insufficient_independence_evidence';
 reporters:InstitutionRecord[];
};
export const FUND_SOURCE_STATUS=[
 {provider:'Vanguard',frequency:'Varies by fund',status:'source adapter pending',note:'No verified direct holdings feed is connected. Some disclosures are index-driven.'},
 {provider:'BlackRock / iShares',frequency:'Varies by fund',status:'source adapter pending',note:'Do not infer discretionary buying from ETF share changes or daily fund holdings.'},
 {provider:'State Street / SPDR',frequency:'Varies by fund',status:'source adapter pending',note:'Daily disclosure is not guaranteed for every fund and does not establish net institutional buying.'}
] as const;
const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function consensusFromReports(records:InstitutionRecord[]):ConsensusRow[]{
 const grouped=new Map<string,InstitutionRecord[]>();
 for(const record of records){
  if(!valid(record.asOfDate)||!valid(record.publishedDate)||record.publishedDate<record.asOfDate||
     !/^[A-Z0-9]{9}$/.test(record.cusip)||!record.sourceUrl?.startsWith('https://www.sec.gov/')&&!record.sourceUrl?.startsWith('https://data.sec.gov/')||
     !Number.isFinite(record.shares)||record.shares<0)continue;
  const key=record.asOfDate+'|'+record.key;
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key)!.push(record);
 }
 const results:ConsensusRow[]=[];
 for(const reporters of grouped.values()){
  const original=reporters[0]; const verifiedActive=new Map<string,InstitutionRecord[]>();
  const passive=new Set<string>();const unknown=new Set<string>();
  for(const record of reporters){
   const verified=Boolean(record.familyId&&record.independenceEvidence?.startsWith('https://')&&record.strategyEvidence?.startsWith('https://'));
   if(!verified||record.strategy==='unknown'){unknown.add(record.managerCik);continue}
   if(record.strategy==='verified_passive'){passive.add(record.familyId!);continue}
   const group=verifiedActive.get(record.familyId!)||[];
   group.push(record);
   verifiedActive.set(record.familyId!,group);
  }
  const activeEmergingFamilies=[...verifiedActive.values()].filter(group=>group.some(x=>x.change==='newly_reported'||x.change==='reported_increase')).length;
  const verifiedActiveFamilies=verifiedActive.size;
  results.push({
   key:original.key,cusip:original.cusip,issuer:original.issuer,className:original.className,asOfDate:original.asOfDate,
   reportedManagers:new Set(reporters.map(x=>x.managerCik)).size,
   verifiedActiveFamilies,passiveFamilies:passive.size,unclassifiedManagers:unknown.size,
   activeEmergingFamilies,
   provisionalInterest:reporters.filter(x=>x.change==='newly_reported'||x.change==='reported_increase').length,
   signal:verifiedActiveFamilies>=2&&activeEmergingFamilies>=2?'verified_active_convergence':'insufficient_independence_evidence',
   reporters
  });
 }
 return results.sort((a,b)=>b.activeEmergingFamilies-a.activeEmergingFamilies||b.provisionalInterest-a.provisionalInterest||b.reportedManagers-a.reportedManagers||a.issuer.localeCompare(b.issuer));
}
export function reportingRecordsFrom13F(data:{
 cik:string;manager:string;
 latest:{period:string;filed:string;sourceUrl:string};
 rows:{key:string;cusip:string;issuer:string;className:string;shares:number;previousShares:number|null;portfolioPct:number|null;change:InstitutionRecord['change']}[];
}):InstitutionRecord[]{
 return data.rows.map(row=>({
  managerCik:data.cik,managerName:data.manager,familyId:null,independenceEvidence:null,
  strategy:'unknown',strategyEvidence:null,
  asOfDate:data.latest.period,publishedDate:data.latest.filed,sourceUrl:data.latest.sourceUrl,kind:'13f',fundId:null,disclosureFrequency:'quarterly',
  key:row.key,cusip:row.cusip,issuer:row.issuer,className:row.className,
  shares:row.shares,priorShares:row.previousShares,weightPct:row.portfolioPct,change:row.change
 }));
}
