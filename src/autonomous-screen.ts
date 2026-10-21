import {deriveRankingMetrics,scoreCompany,defaultRankWeights,financialComparisonIssue,revenueFactIssue,type SecCompany,type SecMetric} from './ranking-model';
export type ScreenVerdict='preliminary_pass'|'incomplete_financials'|'failed_thresholds'|'stale_financials'|'accounting_review';
export type CoverageCause='absent_source_fact'|'unsupported_taxonomy'|'incompatible_fiscal_periods'|'missing_comparable_prior_year'|'unusable_value'|'source_presence_unknown'|'accounting_reconciliation_required'|'as_of_date_unverified';
export type CoverageIssue={metric:string;cause:CoverageCause;detail:string};
export type ScreenResult={ticker:string;status:ScreenVerdict;reasons:string[];filed:string|null;growth:number|null;fcfMargin:number|null;netMargin:number|null;score:number|null;missingEvidence?:CoverageIssue[];observedCriterionFailures?:string[]};
const DAY=86400000;

// Describe only evidence gaps observable from the normalized SEC response.
// The endpoint reports supported-tag presence separately from selected annual
// values so an absent concept is not confused with an incompatible period.
export function diagnoseFinancialCoverage(company:SecCompany,asOf=new Date().toISOString().slice(0,10)):CoverageIssue[]{
 const m=deriveRankingMetrics(company,null,asOf);
 const byName=new Map(company.metrics.map(metric=>[metric.name,metric]));
 const revenue=byName.get('Revenue');
 const current=revenue?.values[0];
 const issue=(metric:string,cause:CoverageCause,detail:string):CoverageIssue=>({metric,cause,detail});
 const review=(name:string,value:SecMetric['values'][number])=>{
  if(value.filed>asOf)return issue(name,'as_of_date_unverified',`${name}: selected SEC fact was filed ${value.filed}, after the ${asOf} assessment date; no earlier value is substituted.`);
  if(value.reviewIssues?.length)return issue(name,'accounting_reconciliation_required',`${name}: SEC observations require filing reconciliation (${value.reviewIssues.join(', ')}); this value is withheld from screening.`);
  return null;
 };
 const missingMetric=(name:string,metric:SecMetric|undefined):CoverageIssue=>{
  const broader=metric?.excludedBroaderFact;
  const broaderNote=name==='Capital expenditures'&&broader?` A separate ${broader.tag} fact reports USD ${broader.value} for ${broader.end}, accession ${broader.accession}; it can include intangible assets and is not substituted for PP&E capex. Source: ${company.source}.`:'';
  if(company.factTaxonomies?.ifrsFull&&!company.factTaxonomies.usGaap)return issue(name,'unsupported_taxonomy',`${name}: SEC Company Facts contains IFRS but no US-GAAP facts; this US-GAAP screen cannot normalize the issuer.`);
  if(metric?.sourceFactPresent===false)return issue(name,'absent_source_fact',`${name}: no supported US-GAAP source tag appears in SEC Company Facts.${broaderNote}`);
  if(metric?.values.length)return issue(name,'incompatible_fiscal_periods',`${name}: annual facts exist, but none align with the selected revenue fiscal period ending ${current?.end??'unknown'}.${broaderNote}`);
  if(metric?.sourceFactPresent===true)return issue(name,'incompatible_fiscal_periods',`${name}: a supported source tag exists, but no qualifying annual USD 10-K/FY observation was selected.${broaderNote}`);
  return issue(name,'source_presence_unknown',`${name}: normalized annual evidence is unavailable; source-tag presence was not supplied.`);
 };
 if(!current)return [missingMetric('Revenue',revenue)];
 const revenueProblem=revenueFactIssue(revenue,current,asOf);
 const revenueReview=review('Revenue',current)??(revenueProblem?issue('Revenue','accounting_reconciliation_required',revenueProblem):null);
 if(revenueReview)return [revenueReview];
 if(current.value<=0)return [issue('Revenue','unusable_value','Revenue: the selected annual value is not positive, so ratios cannot be calculated.')];
 const issues:CoverageIssue[]=[];
 if(m.growth===null){
  const prior=revenue?.values.find(value=>value.year===current.year-1);
  const priorProblem=revenueFactIssue(revenue,prior,asOf);
  issues.push(prior?(review('Revenue growth',prior)??(priorProblem?issue('Revenue growth','accounting_reconciliation_required',priorProblem):issue('Revenue growth','unusable_value','Revenue growth: the comparable prior-year revenue is not positive.'))):
   issue('Revenue growth','missing_comparable_prior_year',`Revenue growth: no comparable FY ${current.year-1} observation exists for the selected revenue tag.`));
 }
 const aligned=(metric:SecMetric|undefined)=>metric?.values.find(value=>value.year===current.year&&value.end===current.end&&(!value.start||!current.start||value.start===current.start));
 const operating=byName.get('Operating cash flow');
 const capex=byName.get('Capital expenditures');
 const net=byName.get('Net income');
 const comparisonReview=(name:string,metric:SecMetric|undefined,value:SecMetric['values'][number])=>{
  const problem=financialComparisonIssue(company,current,metric,value,asOf);
  return review(name,value)??(problem?issue(name,'accounting_reconciliation_required',problem):null);
 };
 const operatingValue=aligned(operating);
 if(!operatingValue)issues.push(missingMetric('Operating cash flow',operating));
 else {const problem=comparisonReview('Operating cash flow',operating,operatingValue);if(problem)issues.push(problem)}
 const capexValue=aligned(capex);
 if(!capexValue)issues.push(missingMetric('Capital expenditures',capex));
 else if(capexValue.value<0)issues.push(issue('Capital expenditures','unusable_value','Capital expenditures: the annual cash-outflow fact has an unsupported negative value.'));
 else {const problem=comparisonReview('Capital expenditures',capex,capexValue);if(problem)issues.push(problem)}
 const netValue=aligned(net);
 if(!netValue)issues.push(missingMetric('Net income',net));
 else {const problem=comparisonReview('Net income',net,netValue);if(problem)issues.push(problem)}
 return issues;
}

export function initialAutonomousScreen(company:SecCompany,asOf:string):ScreenResult{
 const m=deriveRankingMetrics(company,null,asOf);
 const missingEvidence=diagnoseFinancialCoverage(company,asOf);
 const revenueValues=company.metrics.find(x=>x.name==='Revenue')?.values;
 const annual=revenueValues?.find(x=>x.year===m.year)??revenueValues?.[0];
 const filed=annual?.filed||null;
 const age=filed?Date.parse(asOf+'T00:00:00Z')-Date.parse(filed+'T00:00:00Z'):NaN;
 const recent=Number.isFinite(age)&&age>=0&&age<=550*DAY;
 const observedCriterionFailures:string[]=[];
 if(m.growth!==null&&m.growth<10)observedCriterionFailures.push('Annual revenue growth below provisional +10% floor');
 if(m.fcfMargin!==null&&m.fcfMargin<0)observedCriterionFailures.push('Negative operating FCF after capex');
 if(m.profitMargin!==null&&m.profitMargin< -10)observedCriterionFailures.push('Net margin below provisional −10% threshold');
 const base={ticker:company.ticker,filed,growth:m.growth,fcfMargin:m.fcfMargin,netMargin:m.profitMargin,score:null as number|null,missingEvidence,observedCriterionFailures};
 const partialReasons=[...missingEvidence.map(item=>item.detail),...observedCriterionFailures.map(reason=>'Observed criterion failure despite incomplete evidence: '+reason)];
 if(!recent)return {...base,status:'stale_financials',reasons:['Current annual SEC filing not established',...partialReasons]};
 if(m.growth===null||m.fcfMargin===null||m.profitMargin===null)return {...base,status:'incomplete_financials',reasons:partialReasons.length?partialReasons:['Comparable consecutive-year revenue, FCF or net income missing']};
 // Exceptional growth or FCF > revenue may be legitimate but also expose a
 // segment/total revenue error. Never automatically promote either case.
 if(m.fcfMargin>100||m.profitMargin>100||m.growth>200)return {...base,status:'accounting_review',reasons:['Unusually high SEC ratio; reconcile consolidated revenue, net cash flows and recurring earnings against the 10-K before ranking']};
 const reasons=observedCriterionFailures;
 if(reasons.length)return {...base,status:'failed_thresholds',reasons};
 if(company.metrics.find(x=>x.name==='Revenue')?.quality==='alternative_revenue_concepts')return {...base,status:'accounting_review',reasons:['Conflicting smaller SEC revenue tags could represent business segments; confirm consolidated amounts against the annual 10-K']};
 const score=scoreCompany(company,{...defaultRankWeights,pe:0},null,asOf).score;
 if(score===null)return {...base,status:'incomplete_financials',reasons:['Insufficient or stale scored SEC fundamentals']};
 return {...base,status:'preliminary_pass',score,reasons:['Annual revenue growth ≥10%','Nonnegative FCF margin','Net margin ≥−10%']};
}
export function coverageCauseCounts(results:ScreenResult[],sourceFailures:number){
 const count=(cause:CoverageCause)=>results.filter(result=>result.missingEvidence?.some(item=>item.cause===cause)).length;
 return {absentSourceFact:count('absent_source_fact'),unsupportedTaxonomy:count('unsupported_taxonomy'),incompatibleFiscalPeriods:count('incompatible_fiscal_periods'),missingComparablePriorYear:count('missing_comparable_prior_year'),unusableValue:count('unusable_value'),sourcePresenceUnknown:count('source_presence_unknown'),accountingReconciliationRequired:count('accounting_reconciliation_required'),asOfDateUnverified:count('as_of_date_unverified'),sourceRetrievalFailure:sourceFailures,incompleteWithObservedFailures:results.filter(result=>result.status==='incomplete_financials'&&Boolean(result.observedCriterionFailures?.length)).length};
}
export function scanCounts(results:ScreenResult[],sourceFailures:number,universeEnumerated:number){
 const count=(value:ScreenVerdict)=>results.filter(x=>x.status===value).length;
 return {enumerated:universeEnumerated,financialRecordsChecked:results.length,sourceFailures,
  preliminary:count('preliminary_pass'),incomplete:count('incomplete_financials'),failed:count('failed_thresholds'),stale:count('stale_financials'),accountingReview:count('accounting_review')};
}
