// Transparent first-stage SEC research ranking. Not a statistically validated
// return model. Missing inputs never earn points and are ALWAYS disclosed.
import {assessFinancialMethodologyEligibility} from './financial-methodology-eligibility';
export type Annual={year:number;start?:string|null;end:string;filed:string;value:number;unit?:string;form:string;accession:string;tag?:string;reviewIssues?:string[]};
export type SecMetric={name:string;unit?:string;values:Annual[];tag?:string|null;reportingScope?:string|null;quality?:string;selectionNote?:string;alternativeTags?:string[];sourceFactPresent?:boolean;excludedBroaderFact?:Annual};
// An exceptional cross-filing comparison requires a reviewed record tied to
// the exact observations. The SEC endpoint never creates these records.
export type FilingComparisonReview={status:'reviewed_against_filings';metric:string;fiscalYear:number;periodStart:string;periodEnd:string;revenueAccession:string;metricAccession:string;revenueValue:number;metricValue:number;revenueReportingScope:'entity_wide';metricReportingScope:string;operationsScope:'total_operations';reviewer:string;reviewedAt:string;revenueFilingUrl:string;metricFilingUrl:string;scopeNote:string};
type SecIndustryBase={system:'SEC SIC';source:string;retrievedAt:string};
export type SecIndustryClassification=
 | SecIndustryBase&{status:'reported';code:string;description:string}
 | SecIndustryBase&{status:'unavailable';code:null;description:null;reason:string};
export type SecCompany={ticker:string;name:string;cik?:string;source:string;retrievedAt:string;classification?:SecIndustryClassification;factTaxonomies?:{usGaap:boolean;ifrsFull:boolean};filingComparisonReviews?:FilingComparisonReview[];metrics:SecMetric[]};
export type RankWeights={growth:number;fcf:number;profit:number;pe:number};
export type RankMetrics={year:number|null;growth:number|null;fcfMargin:number|null;profitMargin:number|null;pe:number|null;fcf:number|null;revenue:number|null;capex:number|null};
export type Ranked={ticker:string;name:string;year:number|null;source:string;metrics:RankMetrics;score:number|null;coverage:number;count:number;reasons:string[];missing:string[];annualFiled:string|null};
export type MarketValuationClose={ticker:string;price:number;sessionDate:string;feed:string;provider:string;completedSession:boolean;splitValidation?:string;iex20?:{sessionCount:number;startDate:string;endDate:string;avgDailyIexShares:number;avgDailyIexDollarVolume:number;coverage:string}|null};
export type AnnualPe={pe:number|null;eps:number|null;epsEnd:string|null;priceDate:string|null;reason:string};
export function annualPeFromSec(company:SecCompany,quote:MarketValuationClose|null):AnnualPe{
 const base={pe:null,eps:null,epsEnd:null,priceDate:quote?.sessionDate??null};
 if(!quote||quote.ticker!==company.ticker||quote.feed!=='IEX'||!quote.completedSession||!Number.isFinite(quote.price)||quote.price<=0)return {...base,reason:'Completed IEX close unavailable'};
 const rev=recent(company.metrics.find(x=>x.name==='Revenue')?.values||[])[0];
 const eps=recent(company.metrics.find(x=>x.name==='Diluted EPS')?.values||[]).find(x=>rev&&x.end===rev.end);
 if(!eps||eps.value<=0||!Number.isFinite(eps.value))return {...base,reason:'Matching positive annual diluted EPS not available'};
 if(!rev||rev.filed>quote.sessionDate||rev.reviewIssues?.length||eps.reviewIssues?.length||
  (rev.start&&eps.start&&rev.start!==eps.start)||rev.accession!==eps.accession)return {...base,reason:'Annual earnings and revenue filing evidence requires reconciliation as of the quoted close'};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(eps.filed)||Date.parse(eps.filed+'T00:00:00Z')>Date.parse(quote.sessionDate+'T00:00:00Z'))return {...base,reason:'SEC EPS not yet published as of IEX close'};
 const age=Date.parse(quote.sessionDate+'T00:00:00Z')-Date.parse(eps.filed+'T00:00:00Z');
 if(!Number.isFinite(age)||age<0||age>550*86400000)return {...base,reason:'Reported annual EPS is stale'};
 const pe=Math.round(quote.price/eps.value*100)/100;
 if(!Number.isFinite(pe)||pe<=0||pe>1000)return {...base,reason:'Computed annual earnings multiple outside supported range'};
 return {pe,eps:eps.value,epsEnd:eps.end,priceDate:quote.sessionDate,reason:'Indicative fiscal-year P/E; TTM earnings and post-filing share splits not verified'};
}
export const defaultRankWeights:RankWeights={growth:30,fcf:35,profit:20,pe:15};
const finite=(n:number)=>Number.isFinite(n);
const percent=(n:number)=>Math.round(n*100)/100;
const recent=(list:Annual[])=>[...list].filter(r=>r&&finite(r.value)&&/^\d{4}-\d{2}-\d{2}$/.test(r.end)).sort((a,b)=>b.year-a.year);
const iso=(value:string|undefined|null)=>Boolean(value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value);
const accession=(value:string|undefined)=>Boolean(value&&/^\d{10}-\d{2}-\d{6}$/.test(value));
const usable=(value:Annual|undefined,asOf:string)=>Boolean(value&&Array.isArray(value.reviewIssues)&&!value.reviewIssues.length&&value.filed<=asOf&&iso(value.filed)&&iso(value.start)&&iso(value.end)&&value.start!<value.end&&value.filed>=value.end&&value.year===Number(value.end.slice(0,4))&&
 (Date.parse(value.end+'T00:00:00Z')-Date.parse(value.start!+'T00:00:00Z'))/86400000>=300&&
 (Date.parse(value.end+'T00:00:00Z')-Date.parse(value.start!+'T00:00:00Z'))/86400000<=400&&
 value.unit==='USD'&&value.form==='10-K'&&accession(value.accession));
const samePeriod=(value:Annual,reference:Annual)=>value.year===reference.year&&value.end===reference.end&&value.start===reference.start;
const filingUrl=(cik:string|undefined,accn:string,url:string)=>Boolean(cik&&/^\d{10}$/.test(cik)&&typeof url==='string'&&url.startsWith(`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accn.replaceAll('-','')}/`));
function reviewedCrossFiling(company:SecCompany,reference:Annual,metric:SecMetric,value:Annual,asOf:string){
 return company.filingComparisonReviews?.some(review=>review.status==='reviewed_against_filings'&&review.metric===metric.name&&
  review.fiscalYear===reference.year&&review.periodStart===reference.start&&review.periodEnd===reference.end&&
  review.revenueAccession===reference.accession&&review.metricAccession===value.accession&&
  review.revenueValue===reference.value&&review.metricValue===value.value&&
  review.revenueReportingScope==='entity_wide'&&review.metricReportingScope===metric.reportingScope&&review.operationsScope==='total_operations'&&
  iso(review.reviewedAt)&&review.reviewedAt<=asOf&&review.reviewedAt>=value.filed&&review.reviewedAt>=reference.filed&&
  typeof review.reviewer==='string'&&Boolean(review.reviewer.trim())&&typeof review.scopeNote==='string'&&Boolean(review.scopeNote.trim())&&
  filingUrl(company.cik,reference.accession,review.revenueFilingUrl)&&filingUrl(company.cik,value.accession,review.metricFilingUrl))??false;
}
export function revenueFactIssue(metric:SecMetric|undefined,value:Annual|undefined,asOf:string):string|null{
 if(!metric||metric.unit!=='USD'||metric.reportingScope!=='entity_wide'||!metric.tag)return 'Revenue source unit, concept, or reporting scope requires review';
 if(!value||!usable(value,asOf))return 'Revenue filing provenance, period, unit, or assessment date requires review';
 return null;
}
export function financialComparisonIssue(company:SecCompany,reference:Annual|undefined,metric:SecMetric|undefined,value:Annual|undefined,asOf:string):string|null{
 const revenue=company.metrics.find(item=>item.name==='Revenue');
 const revenueIssue=revenueFactIssue(revenue,reference,asOf);
 if(!reference)return revenueIssue??'Revenue fact unavailable';
 if(revenueIssue)return revenueIssue;
 if(!metric||!value)return 'Matching annual source observation unavailable';
 if(!samePeriod(value,reference))return 'Fiscal start or end does not match revenue';
 if(!usable(value,asOf)||metric.unit!=='USD')return 'Annual source provenance, unit, review flags, or assessment date requires review';
 const expectedTags:Record<string,string[]>={'Operating cash flow':['NetCashProvidedByUsedInOperatingActivities'],'Capital expenditures':['PaymentsToAcquirePropertyPlantAndEquipment'],'Net income':['NetIncomeLoss','ProfitLoss']};
 if(expectedTags[metric.name]&&!expectedTags[metric.name].includes(metric.tag??''))return 'Financial source concept requires review';
 if(metric.name==='Operating cash flow'&&metric.reportingScope!=='total_operations')return 'Operating cash-flow reporting scope requires review';
 if(metric.name==='Capital expenditures'&&metric.reportingScope!=='unallocated_cash_purchases')return 'Cash-purchase reporting scope requires review';
 if(metric.name==='Net income'&&!['consolidated','parent_attributable'].includes(metric.reportingScope??''))return 'Net-income reporting scope requires review';
 if(value.accession!==reference.accession&&!reviewedCrossFiling(company,reference,metric,value,asOf))return 'Different filing accessions require documented reconciliation';
 return null;
}
const matchYear=(company:SecCompany,metric:SecMetric|undefined,reference:Annual,asOf:string)=>{
 const value=recent(metric?.values||[]).find(x=>samePeriod(x,reference));
 return financialComparisonIssue(company,reference,metric,value,asOf)===null?value!.value:null;
};
const cap=(n:number)=>Math.max(0,Math.min(100,n));
const normalized=(x:number,lo:number,hi:number)=>cap((x-lo)/(hi-lo)*100);
export function deriveRankingMetrics(company:SecCompany,pe:number|null=null,asOf=new Date().toISOString().slice(0,10)):RankMetrics{
 const m=new Map(company.metrics.map(x=>[x.name,x]));
 const revenueMetric=m.get('Revenue');
 const rev=recent(revenueMetric?.values||[]);
 const current=rev[0];
 if(revenueFactIssue(revenueMetric,current,asOf))return {year:null,growth:null,fcfMargin:null,profitMargin:null,pe:validPe(pe),fcf:null,revenue:null,capex:null};
 const year=current.year, revenue=current.value;
 const previous=rev.find(r=>r.year===year-1);
 const growth=previous&&!revenueFactIssue(revenueMetric,previous,asOf)&&previous.value>0?percent((revenue/previous.value-1)*100):null;
 const operating=matchYear(company,m.get('Operating cash flow'),current,asOf);
 const rawCapex=matchYear(company,m.get('Capital expenditures'),current,asOf);
 // SEC GAAP capex payments are normally nonnegative. Reject negative values
 // instead of silently applying the wrong cash flow sign.
 const capex=rawCapex!==null&&rawCapex>=0?rawCapex:null;
 const fcf=operating!==null&&capex!==null?operating-capex:null;
 const fcfMargin=revenue>0&&fcf!==null?percent(fcf/revenue*100):null;
 const net=matchYear(company,m.get('Net income'),current,asOf);
 const profitMargin=revenue>0&&net!==null?percent(net/revenue*100):null;
 return {year,growth,fcfMargin,profitMargin,pe:validPe(pe),fcf,revenue,capex};
}
function validPe(pe:number|null):number|null{return pe!==null&&finite(pe)&&pe>0&&pe<=1000?pe:null}
export type FcfStrengthAssessment = {
  status: 'improving' | 'not_improving' | 'insufficient_evidence';
  years: number[];
  margins: (number|null)[];
};

export function assessEmergingFcfStrength(company:SecCompany,asOf=new Date().toISOString().slice(0,10)): FcfStrengthAssessment{
  if(assessFinancialMethodologyEligibility(company,asOf).status!=='provisional_operating')
    return {status:'insufficient_evidence',years:[],margins:[]};
  const m=new Map(company.metrics.map(x=>[x.name,x]));
  const rev=recent(m.get('Revenue')?.values||[]);
  
  // Need at least 3 years to evaluate consecutive trends
  if(rev.length < 3) return {status:'insufficient_evidence',years:[],margins:[]};
  
  // Find three consecutive years starting from the most recent
  const latestYear = rev[0].year;
  let consecYears: number[] = [];
  
  // Try to find 3 consecutive years by checking if year n, n-1, n-2 all exist in the data
  for (let i = 0; i < rev.length - 2; i++) {
    const y1 = rev[i].year;
    const y2 = rev[i+1].year;
    const y3 = rev[i+2].year;
    
    // Check if these years are consecutive (latest, previous, previous-previous)
    if (y1 === latestYear && y2 === latestYear - 1 && y3 === latestYear - 2) {
      consecYears = [y1, y2, y3];
      break;
    }
  }
  
  // If no consecutive years found
  if (consecYears.length !== 3) {
    return {status:'insufficient_evidence',years:[],margins:[]};
  }
  
  // Get margins for the three consecutive years
  const years: number[] = [];
  const margins: (number|null)[] = [];
  
  for(let i = 0; i < consecYears.length; i++){
    const year = consecYears[i];
    
    // Find the specific record that matches this year and period-end
    const yearData = rev.find(d => d.year === year);
    if (!yearData) {
      return {status:'insufficient_evidence',years:[],margins:[]};
    }
    
    years.push(year);
    
    // Match all required financial components for this specific fiscal year/period
    if(revenueFactIssue(m.get('Revenue'),yearData,asOf))return {status:'insufficient_evidence',years:[],margins:[]};
    const operating = matchYear(company,m.get('Operating cash flow'), yearData,asOf);
    const rawCapex = matchYear(company,m.get('Capital expenditures'), yearData,asOf);
    const revenue = yearData.value;
    
    // Must have all components available for a valid calculation
    if(operating === null || rawCapex === null || revenue <= 0) {
      return {status:'insufficient_evidence',years:[],margins:[]};
    }
    
    const capex = rawCapex >= 0 ? rawCapex : null;
    if(capex === null) return {status:'insufficient_evidence',years:[],margins:[]};
    
    const fcf = operating - capex;
    const margin = revenue > 0 ? Math.round((fcf/revenue)*10000)/100 : null;
    margins.push(margin);
  }
  
  // Verify all three years have valid data for the complete calculation
  if(years.length !== 3 || margins.some(m => m === null)) {
    return {status:'insufficient_evidence',years:[],margins:[]};
  }
  
  // Calculate improvements from oldest to newest (year1 to year2, then year2 to year3)
  const improvement1 = margins[1] !== null && margins[2] !== null ? margins[1] - margins[2] : null;
  const improvement2 = margins[0] !== null && margins[1] !== null ? margins[0] - margins[1] : null;
  
  // Check if both yearly changes are positive and total improvement is at least 10 percentage points
  const bothPositive = improvement1 !== null && improvement2 !== null && improvement1 > 0 && improvement2 > 0;
  const totalImprovement = improvement1 !== null && improvement2 !== null ? improvement1 + improvement2 : null;
  
  if(bothPositive && totalImprovement !== null && totalImprovement >= 10) {
    return {status:'improving',years, margins};
  } else {
    return {status:'not_improving',years, margins};
  }
}
export function scoreCompany(company:SecCompany,weights:RankWeights,manualPe:number|null=null,asOf=new Date().toISOString().slice(0,10)):Ranked{
  const metrics=deriveRankingMetrics(company,manualPe,asOf);
  const methodology=assessFinancialMethodologyEligibility(company,asOf);
  const annualFiled=company.metrics.find(m=>m.name==='Revenue')?.values.find(v=>v.year===metrics.year)?.filed??null;
  const age=annualFiled?Date.parse(asOf+'T00:00:00Z')-Date.parse(annualFiled+'T00:00:00Z'):NaN;
  const stale=!Number.isFinite(age)||age>550*86400000||age<0;
  const total=Object.values(weights).reduce((sum,n)=>sum+(finite(n)&&n>0?n:0),0);
  const points:{key:keyof RankWeights;value:number|null;grade:number}[]=[
   {key:'growth',value:metrics.growth,grade:metrics.growth===null?0:normalized(metrics.growth,-10,35)},
   {key:'fcf',value:metrics.fcfMargin,grade:metrics.fcfMargin===null?0:normalized(metrics.fcfMargin,-5,25)},
   {key:'profit',value:metrics.profitMargin,grade:metrics.profitMargin===null?0:normalized(metrics.profitMargin,-5,25)},
   {key:'pe',value:metrics.pe,grade:metrics.pe===null?0:metrics.pe<=0?0:cap((60-metrics.pe)/55*100)}
  ];
  const active=points.filter(p=>weights[p.key]>0);
  const observed=active.filter(p=>p.value!==null);
  const evidenceWeight=observed.reduce((sum,p)=>sum+weights[p.key],0);
  const coverage=total>0?percent(evidenceWeight/total*100):0;
  const missing:string[]=active.filter(p=>p.value===null).map(p=>p.key==='growth'?'Revenue growth':p.key==='fcf'?'FCF margin':p.key==='profit'?'Net margin':'Automatic FY P/E');
  const reasons=observed.map(p=>(p.key==='growth'?'Revenue growth':p.key==='fcf'?'Free cash flow margin':p.key==='profit'?'Net margin':'SEC earnings / IEX close FY P/E')+': '+(p.value===null?'unknown':p.value.toFixed(2))+(p.key==='pe'?'x':'%'));
  if(metrics.year===null)missing.push('SEC fiscal-year revenue');
  if(stale)missing.push('Fresh SEC fiscal financials');
  const hasCore=observed.filter(p=>p.key!=='pe').length>=2;
  const suspicious=metrics.fcfMargin!==null&&metrics.fcfMargin>100;
  if(suspicious)missing.push('FCF exceeds annual revenue — verify issuer accounting concepts and one-off cash flows');
  if(methodology.status!=='provisional_operating')missing.push('Ordinary-company methodology withheld: '+methodology.reason);
  const eligible=methodology.status==='provisional_operating'&&total>0&&coverage>=60&&hasCore&&metrics.year!==null&&!stale&&!suspicious;
  // Missing factors get ZERO weighted credit, not a perfect score.
  const score=eligible?Math.round(observed.reduce((sum,p)=>sum+p.grade*weights[p.key],0)/total):null;
  return {ticker:company.ticker,name:company.name,year:metrics.year,source:company.source,metrics,score,coverage,count:observed.length,reasons,missing,annualFiled};
}
export function rankCompanies(data:SecCompany[],weights:RankWeights,pe:Record<string,number|null>={},asOf=new Date().toISOString().slice(0,10)):Ranked[]{
 return data.map(c=>scoreCompany(c,weights,pe[c.ticker]??null,asOf)).sort((a,b)=>(b.score??-1)-(a.score??-1)||b.coverage-a.coverage||a.ticker.localeCompare(b.ticker));
}
