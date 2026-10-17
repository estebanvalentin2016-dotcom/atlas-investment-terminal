// Automatic, source-dated financing observations. This module is intentionally
// not a cash-runway forecast, debt-maturity schedule or credit assessment.
import type {Annual,SecCompany} from './ranking-model';
import {deriveSurvivalEvidence} from './survival-evidence';

export type FinancingFact={value:number;end:string;filed:string;form:string;accession:string;tag:string|null};
export type FinancingAutomation={
 status:'recent_partial'|'historical_only'|'unavailable';
 asOf:string;cash:FinancingFact|null;currentAssets:FinancingFact|null;currentLiabilities:FinancingFact|null;
 currentDebt:FinancingFact|null;noncurrentDebt:FinancingFact|null;shortBorrowings:FinancingFact|null;
 workingCapital:number|null;currentRatio:number|null;reportedDebtSubtotal:number|null;debtFields:number;
 annualFcf:number|null;cashToHistoricalBurnYears:number|null;
 shareCountWarning:string|null;weightedDilutedShares:number|null;notes:string[];source:string;
};
const validDate=(s:string)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const age=(newer:string,older:string)=>(Date.parse(newer+'T00:00:00Z')-Date.parse(older+'T00:00:00Z'))/86400000;
const acceptableForms=new Set(['10-K','10-Q','10-K/A','10-Q/A']);
function pick(company:SecCompany,name:string,asOf:string,period?:string):FinancingFact|null{
 const metric=company.metrics.find(x=>x.name===name);
 const rows=(metric?.values??[]).filter((v:Annual)=>validDate(v.end)&&validDate(v.filed)&&
  v.end<=v.filed&&v.filed<=asOf&&v.end<=asOf&&acceptableForms.has(v.form)&&
  Number.isFinite(v.value)&&v.value>=0&&typeof v.accession==='string'&&
  /^\d{10}-\d{2}-\d{6}$/.test(v.accession)&&(!period||v.end===period))
  .sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed));
 if(!rows.length)return null;
 const newest=rows[0];
 // One filing/end with contradictory observations may represent hidden dimensions;
 // never cherry-pick such a number and imply it is issuer-wide.
 if(rows.some(v=>v.end===newest.end&&v.accession===newest.accession&&v.value!==newest.value))return null;
 return {value:newest.value,end:newest.end,filed:newest.filed,form:newest.form,accession:newest.accession,tag:metric?.tag??newest.tag??null};
}
const round=(n:number)=>Math.round(n*100)/100;
export function deriveFinancingAutomation(company:SecCompany,asOf:string):FinancingAutomation{
 const notes:string[]=[];
 const empty:FinancingAutomation={status:'unavailable',asOf,cash:null,currentAssets:null,currentLiabilities:null,
  currentDebt:null,noncurrentDebt:null,shortBorrowings:null,workingCapital:null,currentRatio:null,
  reportedDebtSubtotal:null,debtFields:0,annualFcf:null,cashToHistoricalBurnYears:null,
  shareCountWarning:null,weightedDilutedShares:null,notes,source:company.source};
 if(!validDate(asOf)){notes.push('The as-of date is invalid.');return empty}
 const cash=pick(company,'Latest cash and cash equivalents',asOf);
 const end=cash?.end??null;
 const currentAssets=end?pick(company,'Latest current assets',asOf,end):null;
 const currentLiabilities=end?pick(company,'Latest current liabilities',asOf,end):null;
 const currentDebt=end?pick(company,'Latest current long-term debt',asOf,end):null;
 const noncurrentDebt=end?pick(company,'Latest noncurrent long-term debt',asOf,end):null;
 const shortBorrowings=end?pick(company,'Latest short-term borrowings',asOf,end):null;
 const debt=[currentDebt,noncurrentDebt,shortBorrowings];
 const debtFields=debt.filter(x=>x!==null).length;
 const reportedDebtSubtotal=debtFields===3?debt.reduce((sum,x)=>sum+(x?.value??0),0):null;
 const workingCapital=currentAssets&&currentLiabilities?currentAssets.value-currentLiabilities.value:null;
 const currentRatio=currentAssets&&currentLiabilities&&currentLiabilities.value>0?round(currentAssets.value/currentLiabilities.value):null;
 const survival=deriveSurvivalEvidence(company,asOf);
 const annualFcf=survival.freeCashFlow;
 const recent=!!cash&&age(asOf,cash.end)<=200;
 const cashToHistoricalBurnYears=recent&&cash&&annualFcf!==null&&annualFcf<0&&
  survival.fiscalEnd!==null&&cash.end>=survival.fiscalEnd?round(cash.value/-annualFcf):null;
 const annualShares=survival.weightedDilutedShares?.value??null;
 const annualEnd=survival.weightedDilutedShares?.fiscalEnd??null;
 const outstanding=pick(company,'Common shares outstanding (DEI)',asOf);
 let shareCountWarning:string|null=null;
 if(annualShares!==null&&annualShares>0&&annualEnd&&outstanding&&Math.abs(age(outstanding.end,annualEnd))<=550){
  const ratio=annualShares/outstanding.value;
  if(ratio<0.05||ratio>20)shareCountWarning=
   'Annual diluted weighted-average shares ('+annualShares.toLocaleString('en-US')+') differ by more than 20-fold from DEI point-in-time shares ('+
   outstanding.value.toLocaleString('en-US')+'). Units, issuer structure or classes may be incompatible. Do NOT use the annual count to assess dilution or per-share value until reconciled.';
 }
 if(!cash)notes.push('No publicly filed, source-dated instant cash observation from supported 10-Q/10-K GAAP tags.');
 else notes.push('Latest reported cash is from '+cash.form+' period '+cash.end+', filed '+cash.filed+'. This is a historical observation, not cash available today.');
 if(cash&&!recent)notes.push('The most recent reported cash period is over 200 days old; avoid presenting historical cash as current liquidity.');
 if(!currentAssets||!currentLiabilities)notes.push('Matching-period current assets/current liabilities are unavailable; working capital/current ratio cannot be computed.');
 if(debtFields!==3)notes.push('Only '+debtFields+'/3 sampled debt components were reported for that period. Missing does not mean zero; no subtotal or maturity conclusion is permitted.');
 else notes.push('The debt subtotal uses only three sampled US-GAAP components. Leases, converts, classification overlap and maturity dates are not reconciled.');
 if(cashToHistoricalBurnYears!==null)notes.push('Cash ÷ prior annual negative FCF is a mechanical historical stress ratio, NOT forecast runway; excludes future financing, capex changes, debt maturities and restricted cash.');
 else notes.push('A comparable cash-to-negative-annual-FCF coverage ratio cannot be established; this is not evidence of unlimited runway.');
 if(shareCountWarning)notes.push(shareCountWarning);
 notes.push('Automatic evidence collection is underway. Full funding capacity, maturity schedules, convertibles, upcoming equity issuance and a dilution-adjusted valuation remain unverified.');
 return {...empty,status:cash?(recent?'recent_partial':'historical_only'):'unavailable',
  cash,currentAssets,currentLiabilities,currentDebt,noncurrentDebt,shortBorrowings,
  workingCapital,currentRatio,reportedDebtSubtotal,debtFields,annualFcf,cashToHistoricalBurnYears,
  shareCountWarning,weightedDilutedShares:shareCountWarning?null:annualShares};
}
