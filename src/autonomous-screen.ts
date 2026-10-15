import {deriveRankingMetrics,scoreCompany,defaultRankWeights,type SecCompany} from './ranking-model';
export type ScreenVerdict='preliminary_pass'|'incomplete_financials'|'failed_thresholds'|'stale_financials';
export type ScreenResult={ticker:string;status:ScreenVerdict;reasons:string[];filed:string|null;growth:number|null;fcfMargin:number|null;netMargin:number|null;score:number|null};
const DAY=86400000;
export function initialAutonomousScreen(company:SecCompany,asOf:string):ScreenResult{
 const m=deriveRankingMetrics(company);
 const annual=company.metrics.find(x=>x.name==='Revenue')?.values.find(x=>x.year===m.year);
 const filed=annual?.filed||null;
 const age=filed?Date.parse(asOf+'T00:00:00Z')-Date.parse(filed+'T00:00:00Z'):NaN;
 const recent=Number.isFinite(age)&&age>=0&&age<=550*DAY;
 const base={ticker:company.ticker,filed,growth:m.growth,fcfMargin:m.fcfMargin,netMargin:m.profitMargin,score:null as number|null};
 if(!recent)return {...base,status:'stale_financials',reasons:['Current annual SEC filing not established']};
 if(m.growth===null||m.fcfMargin===null||m.profitMargin===null)return {...base,status:'incomplete_financials',reasons:['Comparable consecutive-year revenue, FCF or net income missing']};
 const reasons:string[]=[];
 if(m.growth<10)reasons.push('Annual revenue growth below provisional +10% floor');
 if(m.fcfMargin<0)reasons.push('Negative operating FCF after capex');
 if(m.profitMargin< -10)reasons.push('Net margin below provisional −10% threshold');
 if(reasons.length)return {...base,status:'failed_thresholds',reasons};
 const score=scoreCompany(company,{...defaultRankWeights,pe:0}).score;
 if(score===null)return {...base,status:'incomplete_financials',reasons:['Insufficient or stale scored SEC fundamentals']};
 return {...base,status:'preliminary_pass',score,reasons:['Annual revenue growth ≥10%','Nonnegative FCF margin','Net margin ≥−10%']};
}
export function scanCounts(results:ScreenResult[],sourceFailures:number,universeEnumerated:number){
 const count=(value:ScreenVerdict)=>results.filter(x=>x.status===value).length;
 return {enumerated:universeEnumerated,financialRecordsChecked:results.length,sourceFailures,
  preliminary:count('preliminary_pass'),incomplete:count('incomplete_financials'),failed:count('failed_thresholds'),stale:count('stale_financials')};
}
