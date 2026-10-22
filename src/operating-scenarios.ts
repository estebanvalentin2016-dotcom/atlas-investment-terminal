// ATLAS: mechanical five-year operating sensitivities, NOT company-specific
// forecasts, equity value, price targets or investment recommendations.
// Presets are explicitly illustrative; they carry no assigned probabilities.
import type {Annual,SecCompany} from './ranking-model';
import {assessFinancialMethodologyEligibility} from './financial-methodology-eligibility';

export type ScenarioCase='Bear'|'Base sensitivity'|'Bull'|'Remote moonshot';
export type OperatingScenario={name:ScenarioCase;annualRevenueGrowthPct:number;fy5FcfMarginPct:number;fy5Revenue:number;fy5Fcf:number;years:{year:number;revenue:number;fcf:number}[]};
export type OperatingScenarioEvidence={
 status:'partial'|'blocked';source:string;fiscalEnd:string|null;filed:string|null;initialRevenue:number|null;
 observedRevenueGrowthPct:number|null;observedFcfMarginPct:number|null;rows:OperatingScenario[];
 reasons:string[];caution:string;
};
const dateOk=(s:string)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const elapsed=(newer:string,older:string)=>(Date.parse(newer+'T00:00:00Z')-Date.parse(older+'T00:00:00Z'))/86400000;
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const round=(n:number)=>Math.round(n*100)/100;
const caution='Illustrative operating sensitivity only, NOT a forecast or five-year per-share valuation. Preset growth/margin shocks are chosen by ATLAS for stress testing, not validated against forward guidance or sector peers. Debt, financing, share issuance, taxes, market multiples and competitive evidence remain unresolved; price targets and expected returns are intentionally withheld.';
export function deriveOperatingScenarios(company:SecCompany,asOf:string):OperatingScenarioEvidence{
 const reasons:string[]=[];
 const blank:OperatingScenarioEvidence={status:'blocked',source:company.source,fiscalEnd:null,filed:null,initialRevenue:null,
  observedRevenueGrowthPct:null,observedFcfMarginPct:null,rows:[],reasons,caution};
 const methodology=assessFinancialMethodologyEligibility(company,asOf);
 if(methodology.status!=='provisional_operating'){
  reasons.push('Ordinary-company FCF sensitivity withheld: '+methodology.reason);
  return blank;
 }
 if(!dateOk(asOf)||!company.source?.startsWith('https://data.sec.gov/')){reasons.push('SEC issuer provenance or as-of date unavailable.');return blank;}
 const revenueMetric=company.metrics.find(m=>m.name==='Revenue');
 if(!revenueMetric||revenueMetric.quality==='alternative_revenue_concepts'){reasons.push('Issuer-wide annual revenue concept requires SEC reconciliation; no scenarios generated.');return blank;}
 const eligible=(x:Annual)=>dateOk(x.end)&&dateOk(x.filed)&&x.end<=asOf&&x.filed<=asOf&&Number.isFinite(x.value)&&x.value>=0&&x.form==='10-K';
 const revenues=(revenueMetric.values??[]).filter(eligible).sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed));
 const recent=revenues[0];
 if(!recent||recent.value<=0||elapsed(asOf,recent.filed)>550){reasons.push('Fresh, filed, positive issuer revenue unavailable.');return blank;}
 const previous=revenues.find(x=>x.year===recent.year-1&&x.value>0&&x.end!==recent.end);
 if(!previous){reasons.push('Same-concept preceding annual revenue unavailable.');return {...blank,fiscalEnd:recent.end,filed:recent.filed,initialRevenue:recent.value};}
 const fact=(name:string)=>{
  const metric=company.metrics.find(m=>m.name===name);
  const rows=(metric?.values??[]).filter(x=>dateOk(x.end)&&dateOk(x.filed)&&x.end===recent.end&&x.end<=asOf&&x.filed<=asOf&&x.form==='10-K'&&Number.isFinite(x.value)&&(name==='Operating cash flow'||x.value>=0)).sort((a,b)=>b.filed.localeCompare(a.filed));
  return rows[0]?.value??null;
 };
 const op=fact('Operating cash flow'),capex=fact('Capital expenditures');
 if(op===null||capex===null||capex<0){reasons.push('Same-year, publicly filed operating cash flow and nonnegative capex unavailable.');return {...blank,fiscalEnd:recent.end,filed:recent.filed,initialRevenue:recent.value};}
 const historicalGrowth=(recent.value/previous.value-1)*100;
 const historicalMargin=((op-capex)/recent.value)*100;
 if(!Number.isFinite(historicalGrowth)||!Number.isFinite(historicalMargin)||Math.abs(historicalGrowth)>150||historicalMargin>100||historicalMargin< -100){
  reasons.push('Financial growth or FCF margin is anomalous; reconcile accounting before extrapolating any case.');
  return {...blank,fiscalEnd:recent.end,filed:recent.filed,initialRevenue:recent.value};
 }
 const observedGrowth=round(historicalGrowth),observedMargin=round(historicalMargin);
 // The following are explicit mechanical stress knobs, NOT a forecast:
 // bear: growth -20pp / margin -8pp; base: half growth / same margin;
 // bull: same growth / +4pp; remote moonshot: growth +10pp / +8pp.
 // Clamp extreme operating values to avoid nonsensical runaway display.
 const specs:{name:ScenarioCase;growth:number;margin:number}[]=[
  {name:'Bear',growth:clamp(observedGrowth-20,-20,30),margin:clamp(observedMargin-8,-50,50)},
  {name:'Base sensitivity',growth:clamp(observedGrowth/2,-20,30),margin:clamp(observedMargin,-50,50)},
  {name:'Bull',growth:clamp(observedGrowth,-20,35),margin:clamp(observedMargin+4,-50,50)},
  {name:'Remote moonshot',growth:clamp(observedGrowth+10,-20,45),margin:clamp(observedMargin+8,-50,50)}
 ];
 const rows=specs.map(spec=>{
  const growth=round(spec.growth),margin=round(spec.margin);
  const years=Array.from({length:5},(_,i)=>{
   const year=i+1,revenue=recent.value*Math.pow(1+growth/100,year);
   return {year,revenue,fcf:revenue*margin/100};
  });
  return {name:spec.name,annualRevenueGrowthPct:growth,fy5FcfMarginPct:margin,
   fy5Revenue:years[4].revenue,fy5Fcf:years[4].fcf,years};
 });
 return {status:'partial',source:company.source,fiscalEnd:recent.end,filed:recent.filed,initialRevenue:recent.value,
  observedRevenueGrowthPct:observedGrowth,observedFcfMarginPct:observedMargin,rows,reasons,caution};
}
