import {attachFilingScopeEvidence,reconcileAnnualSecFacts} from './sec-financial-normalization.mjs';

// Experimental ATLAS-defined non-GAAP measure. Never import into screening/ranking.
export const CANDIDATE_FCF_VERSION='atlas-comparable-fcf-candidate-v1';
export const CANDIDATE_FCF_DEFINITION='Reconciled operating cash flow less cash purchases of productive long-lived assets (PP&E, capitalized software, and productive intangibles).';
const OPERATING=new Set(['NetCashProvidedByUsedInOperatingActivities','NetCashProvidedByUsedInOperatingActivitiesContinuingOperations']);
const AGGREGATE='PaymentsToAcquireProductiveAssets';
const COMPONENTS={
 ppe:'PaymentsToAcquirePropertyPlantAndEquipment',
 software:'PaymentsToDevelopSoftware',
 intangible:'PaymentsToAcquireIntangibleAssets'
};
const ALLOWED_SPENDING=new Set([AGGREGATE,...Object.values(COMPONENTS)]);
const fail=(reason,detail,excludedFacts=[])=>({ok:false,formulaVersion:CANDIDATE_FCF_VERSION,definition:CANDIDATE_FCF_DEFINITION,value:null,unit:'USD',reason,detail,inputs:null,selectedFacts:[],excludedFacts,reportingScope:null,provenance:null});
const samePeriod=(fact,query)=>fact.cik===query.cik&&fact.periodStart===query.periodStart&&fact.periodEnd===query.periodEnd;

/**
 * Consumes 4C.1 normalized SEC observations. `review` is an explicit, dated
 * human filing attestation, NOT independently verified by this function.
 * Missing spending categories require affirmative filing review, never zero.
 */
export function calculateCandidateComparableFcfV1({facts,cik,periodStart,periodEnd,asOfDate,operatingConcept,spendingConcepts,review}){
 if(!Array.isArray(facts)||!Number.isSafeInteger(cik)||!Array.isArray(spendingConcepts)||!spendingConcepts.length||
  !OPERATING.has(operatingConcept)||spendingConcepts.some(concept=>!ALLOWED_SPENDING.has(concept)))
  return fail('unsupported_selection','Select one supported operating cash-flow concept and supported cash-investment concept(s).');
 if(new Set(spendingConcepts).size!==spendingConcepts.length)return fail('duplicate_expenditure','The same cash purchase cannot be included twice.');
 const aggregate=spendingConcepts.includes(AGGREGATE);
 if(aggregate&&spendingConcepts.length!==1)return fail('overlapping_expenditures','The aggregate productive-assets concept cannot be summed with components.');
 const classification=review?.classification;
 const submissionsUrl=`https://data.sec.gov/submissions/CIK${String(cik).padStart(10,'0')}.json`;
 if(classification?.status!=='reported'||classification.system!=='SEC SIC'||
  !/^\d{4}$/.test(classification.code)||classification.sourceUrl!==submissionsUrl)
  return fail('industry_unverified','A source-backed SEC SIC classification is required for this nonfinancial experiment.');
 if(Number(classification.code)>=6000&&Number(classification.code)<7000)
  return fail('specialized_business','Financial, real-estate, and related SIC families need a separate cash-flow methodology.');
 if(!review||review.status!=='reviewed_against_filing'||review.businessType!=='nonfinancial_us_gaap_operating'||
  !review.reviewer||!/\d{4}-\d{2}-\d{2}/.test(review.reviewedAt)||review.reviewedAt>asOfDate||!review.filingUrl||!review.accession||
  !review.cashFlowStatementCaption||!review.coverageNote||!review.factCaptions)
  return fail('filing_review_required','A dated, identified review of the original cash-flow filing and spending coverage is required.');
 const requested=[operatingConcept,...spendingConcepts];
 const sameYear=facts.filter(fact=>samePeriod(fact,{cik,periodStart,periodEnd}));
 const availableYear=sameYear.filter(fact=>fact.filedDate<=asOfDate);
 const selected=sameYear.filter(fact=>requested.includes(fact.concept));
 const excludedFacts=sameYear.filter(fact=>!requested.includes(fact.concept)).map(fact=>({fact,reason:fact.filedDate>asOfDate?'not_available_as_of_date':aggregate&&Object.values(COMPONENTS).includes(fact.concept)?'covered_by_aggregate':'not_selected'}));
 for(const concept of requested){
  const source=facts.filter(fact=>fact.cik===cik&&fact.concept===concept);
  if(!source.length)return fail('missing_fact',`${concept}: no SEC cash-flow fact was supplied.`,excludedFacts);
  if(!source.some(fact=>samePeriod(fact,{cik,periodStart,periodEnd})))return fail('incompatible_period',`${concept}: the reported period does not match.`,excludedFacts);
  if(!availableYear.some(fact=>fact.concept===concept))return fail('future_filing',`${concept}: no matching fact was filed by the assessment date.`,excludedFacts);
 }
 if(availableYear.some(fact=>requested.includes(fact.concept)&&fact.form==='10-K/A'))
  return fail('amendment_requires_review','An amended annual filing requires a separately documented reconciliation.',excludedFacts);
 if(!aggregate){
  if(availableYear.some(fact=>fact.concept===AGGREGATE))return fail('aggregate_component_conflict','A reported aggregate overlaps the proposed component route; review the aggregate instead.',excludedFacts);
  for(const [category,concept] of Object.entries(COMPONENTS)){
   const state=review.componentCoverage?.[category];
   if(spendingConcepts.includes(concept)?state!=='selected':state!=='verified_no_separate_cash_purchase')
    return fail('spending_coverage_unverified',`${category}: selected fact or affirmative filing review is required; absence is not zero.`,excludedFacts);
   if(!spendingConcepts.includes(concept)&&availableYear.some(fact=>fact.concept===concept))
    return fail('unselected_expenditure_fact',`${category}: a reported purchase fact was omitted from the candidate.`,excludedFacts);
  }
 }
 if(availableYear.filter(fact=>requested.includes(fact.concept)).some(fact=>fact.accession!==review.accession||fact.filingUrl!==review.filingUrl))
  return fail('filing_review_mismatch','Selected facts do not match the reviewed filing accession and URL.',excludedFacts);
 if(availableYear.filter(fact=>requested.includes(fact.concept)).some(fact=>!review.factCaptions[fact.concept]?.trim()))
  return fail('unverified_filing_caption','Each selected cash-flow line needs a reviewed filing caption.',excludedFacts);
 let annotated;
 try{
  annotated=availableYear.filter(fact=>requested.includes(fact.concept)).map(fact=>attachFilingScopeEvidence(fact,{
   operations:review.operationsScope,attribution:review.attributionScope,
   filingUrl:review.filingUrl,caption:review.factCaptions[fact.concept]
  }));
 }catch{
  return fail('scope_review_mismatch','Reviewed scope conflicts with an SEC concept or lacks a filing reference.',excludedFacts);
 }
 const requests=[{role:'operating',concept:operatingConcept,kind:'operating'},...spendingConcepts.map((concept,index)=>({role:`spending_${index+1}`,concept,kind:'expenditure'}))];
 const disjointEvidence=(review.separateCashLines||[]).filter(item=>item.reviewed===true&&item.filingUrl===review.filingUrl&&item.accession===review.accession);
 const reconciled=reconcileAnnualSecFacts({facts:annotated,cik,periodStart,periodEnd,asOfDate,requests,disjointEvidence});
 if(!reconciled.ok)return fail(reconciled.reason,reconciled.detail,excludedFacts);
 const chosen=reconciled.facts;
 if(chosen.some(item=>!Number.isSafeInteger(item.fact.value)))return fail('unsupported_amount','Cash-flow inputs must be safe whole-dollar SEC values.',excludedFacts);
 const spending=chosen.slice(1);
 if(spending.some(item=>item.fact.value<0))return fail('invalid_cash_purchase','Cash-purchase outflows must be reported as nonnegative amounts.',excludedFacts);
 const productiveCashPurchases=spending.reduce((sum,item)=>sum+item.fact.value,0);
 const operatingCashFlow=chosen[0].fact.value;
 const value=operatingCashFlow-productiveCashPurchases;
 if(!Number.isSafeInteger(productiveCashPurchases)||!Number.isSafeInteger(value))return fail('amount_overflow','The derived whole-dollar result exceeds safe numeric precision.',excludedFacts);
 return {
  ok:true,formulaVersion:CANDIDATE_FCF_VERSION,definition:CANDIDATE_FCF_DEFINITION,value,unit:'USD',reason:null,
  detail:'Experimental ATLAS-defined non-GAAP calculation; not approved screening or investment research.',
  inputs:{operatingCashFlow,productiveCashPurchases,spendingMode:aggregate?'aggregate':'components',components:spending.map(item=>({concept:item.fact.concept,value:item.fact.value}))},
  selectedFacts:chosen,excludedFacts,
  reportingScope:{operations:chosen[0].fact.scope.operations,attribution:chosen[0].fact.scope.attribution},
  provenance:{cik,reportingEntity:chosen[0].fact.reportingEntity,periodStart,periodEnd,asOfDate,
   accession:review.accession,filingUrl:review.filingUrl,companyFactsUrl:chosen[0].fact.sourceUrl,
   filedDate:chosen[0].fact.filedDate,reviewer:review.reviewer,reviewedAt:review.reviewedAt,
   cashFlowStatementCaption:review.cashFlowStatementCaption,coverageNote:review.coverageNote,
   componentCoverage:aggregate?null:review.componentCoverage,classification,
   reviewIsIndependentlyVerified:false}
 };
}
