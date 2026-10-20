// Pure, non-scoring foundation. A reconciled fact set is not an FCF definition.
const isoDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
 !Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const accession=value=>typeof value==='string'&&/^\d{10}-\d{2}-\d{6}$/.test(value);
const unknownScope=()=>({operations:'unknown',attribution:'unknown',basis:'unknown',evidenceUrl:null,caption:null});
const CONCEPT_SCOPES={
 NetCashProvidedByUsedInOperatingActivities:{operations:'total',attribution:'unknown'},
 NetCashProvidedByUsedInOperatingActivitiesContinuingOperations:{operations:'continuing',attribution:'unknown'},
 CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations:{operations:'discontinued',attribution:'unknown'},
 NetIncomeLoss:{operations:'unknown',attribution:'parent_attributable'},
 ProfitLoss:{operations:'unknown',attribution:'consolidated'},
 IncomeLossFromContinuingOperations:{operations:'continuing',attribution:'unknown'},
 IncomeLossFromDiscontinuedOperationsNetOfTaxAttributableToReportingEntity:{operations:'discontinued',attribution:'parent_attributable'}
};
const parentExpenditure='PaymentsToAcquireProductiveAssets';
const expenditureConcepts=new Set([parentExpenditure,'PaymentsToAcquirePropertyPlantAndEquipment','PaymentsToDevelopSoftware','PaymentsToAcquireIntangibleAssets']);
const expenditureOverlap=(a,b)=>a===parentExpenditure||b===parentExpenditure||
 (new Set([a,b]).has('PaymentsToDevelopSoftware')&&new Set([a,b]).has('PaymentsToAcquireIntangibleAssets'));
const reject=(reason,detail)=>({ok:false,reason,detail,facts:[]});

export function normalizeSecFinancialFacts(companyFacts,{cik,concepts,taxonomy='us-gaap',unit='USD',filingUrls={}}){
 if(!Number.isSafeInteger(cik)||cik<=0||!Array.isArray(concepts))throw new TypeError('A resolved CIK and concept list are required');
 if(!Number.isSafeInteger(companyFacts?.cik)||companyFacts.cik!==cik)throw new TypeError('SEC Company Facts CIK does not match the resolved issuer');
 const sourceUrl=`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10,'0')}.json`;
 const reportingEntity=typeof companyFacts?.entityName==='string'&&companyFacts.entityName.trim()?companyFacts.entityName.trim():null;
 const facts=[];
 for(const concept of new Set(concepts)){
  const entries=companyFacts?.facts?.[taxonomy]?.[concept]?.units?.[unit];
  for(const entry of Array.isArray(entries)?entries:[]){
   if(!Number.isFinite(entry?.val)||!isoDate(entry.start)||!isoDate(entry.end)||!isoDate(entry.filed)||
    entry.start>=entry.end||!accession(entry.accn)||!['10-K','10-K/A'].includes(entry.form)||entry.fp!=='FY')continue;
   const known=CONCEPT_SCOPES[concept];
   const filingPrefix=`https://www.sec.gov/Archives/edgar/data/${cik}/${entry.accn.replaceAll('-','')}/`;
   const proposedFilingUrl=filingUrls[entry.accn];
   facts.push({
    cik,reportingEntity,taxonomy,concept,value:entry.val,unit,
    periodStart:entry.start,periodEnd:entry.end,
    fiscalYear:Number.isInteger(entry.fy)?entry.fy:null,fiscalPeriod:entry.fp,
    form:entry.form,accession:entry.accn,filedDate:entry.filed,sourceUrl,
    filingUrl:typeof proposedFilingUrl==='string'&&proposedFilingUrl.startsWith(filingPrefix)?proposedFilingUrl:null,
    scope:known?{...known,basis:'sec_concept',evidenceUrl:sourceUrl,caption:null}:unknownScope()
   });
  }
 }
 return facts;
}

// Reviewer-supplied filing captions may establish a scope that the SEC tag alone
// does not. This stores the evidence; it does not independently audit the caption.
export function attachFilingScopeEvidence(fact,{operations,attribution,filingUrl,caption}){
 if(!fact?.filingUrl||filingUrl!==fact.filingUrl||typeof caption!=='string'||!caption.trim()||
  !['total','continuing','discontinued','unknown'].includes(operations)||
  !['consolidated','parent_attributable','unknown'].includes(attribution)||
  (fact.scope.operations!=='unknown'&&fact.scope.operations!==operations)||
  (fact.scope.attribution!=='unknown'&&fact.scope.attribution!==attribution))throw new TypeError('Filing scope evidence must match the fact and its SEC concept');
 return {...fact,scope:{operations,attribution,basis:'filing_caption_annotation',evidenceUrl:filingUrl,caption:caption.trim()}};
}

// Returns compatible source observations only; never calculates or publishes FCF.
export function reconcileAnnualSecFacts({facts,cik,periodStart,periodEnd,asOfDate,requests,disjointEvidence=[]}){
 if(!Number.isSafeInteger(cik)||!isoDate(periodStart)||!isoDate(periodEnd)||periodStart>=periodEnd||
  !isoDate(asOfDate)||!Array.isArray(facts)||!Array.isArray(requests)||requests.length<2)return reject('invalid_request','Specify one issuer, annual period, assessment date, and at least two fact requests.');
 if(new Set(requests.map(item=>item.role)).size!==requests.length)return reject('duplicate_selection','Each requested financial role must be distinct.');
 if(new Set(requests.map(item=>item.concept)).size!==requests.length)return reject(
  requests.some(item=>item.kind==='expenditure'||expenditureConcepts.has(item.concept))?'duplicate_expenditure':'duplicate_selection',
  'The same SEC concept cannot be counted twice in one reconciliation.'
 );
 const selected=[];
 for(const request of requests){
  const conceptFacts=facts.filter(fact=>fact.concept===request.concept&&fact.cik===cik);
  if(!conceptFacts.length)return reject('missing_fact',`${request.role}: no reported fact was supplied.`);
  const matching=conceptFacts.filter(fact=>fact.periodStart===periodStart&&fact.periodEnd===periodEnd&&fact.unit==='USD');
  if(!matching.length)return reject('incompatible_period',`${request.role}: no USD observation matches both fiscal dates.`);
  if(matching.some(fact=>fact.taxonomy!=='us-gaap'))return reject('unsupported_taxonomy',`${request.role}: this reconciliation supports US-GAAP only.`);
  const available=matching.filter(fact=>fact.filedDate<=asOfDate);
  if(!available.length)return reject('future_filing',`${request.role}: the observation was not filed by ${asOfDate}.`);
  if(available.some(fact=>fact.filedDate<fact.periodEnd))return reject('invalid_filing_date',`${request.role}: the filing date precedes the reported period end.`);
  if(available.some(fact=>fact.form==='10-K/A'))return reject('amendment_requires_review',`${request.role}: an amended annual filing needs explicit review.`);
  if(new Set(available.map(fact=>fact.value)).size>1)return reject('conflicting_facts',`${request.role}: filed observations disagree for the same period.`);
  if(new Set(available.map(fact=>fact.accession)).size>1)return reject('multiple_filings_require_review',`${request.role}: multiple filings report this period; no restatement is selected silently.`);
  selected.push({role:request.role,kind:request.kind,fact:available[0]});
 }
 const chosen=selected.map(item=>item.fact);
 if(chosen.some(fact=>fact.fiscalYear===null))return reject('fiscal_year_unverified','A reported fiscal-year designation is missing.');
 if(new Set(chosen.map(fact=>fact.fiscalYear)).size>1)return reject('fiscal_year_mismatch','Reported fiscal-year designations differ.');
 if(new Set(chosen.map(fact=>fact.accession)).size>1||new Set(chosen.map(fact=>fact.form)).size>1)return reject('filing_mismatch','Facts come from different annual filings.');
 if(new Set(chosen.map(fact=>fact.sourceUrl)).size>1||new Set(chosen.map(fact=>fact.filingUrl)).size>1)return reject('source_mismatch','SEC source references disagree for the selected filing.');
 for(const axis of ['operations','attribution']){
  const values=chosen.map(fact=>fact.scope[axis]);
  if(new Set(values.filter(value=>value!=='unknown')).size>1)return reject('scope_mismatch',`${axis} scopes differ; continuing, discontinued, total, parent and consolidated amounts are not interchangeable.`);
 }
 if(chosen.some(fact=>fact.scope.operations==='unknown'||fact.scope.attribution==='unknown'))return reject('scope_unverified','At least one reporting-scope dimension lacks SEC concept or filing-caption evidence.');
 const expenditures=selected.filter(item=>item.kind==='expenditure'||expenditureConcepts.has(item.fact.concept)).map(item=>item.fact);
 for(let i=0;i<expenditures.length;i++)for(let j=i+1;j<expenditures.length;j++){
  const a=expenditures[i],b=expenditures[j];
  if(expenditureOverlap(a.concept,b.concept))return reject('overlapping_expenditures',`${a.concept} and ${b.concept} can represent overlapping cash outlays.`);
  const pair=[a.concept,b.concept].sort().join('|');
  const evidenced=disjointEvidence.some(item=>Array.isArray(item.concepts)&&[...item.concepts].sort().join('|')===pair&&
   item.filingUrl===a.filingUrl&&item.filingUrl===b.filingUrl&&typeof item.caption==='string'&&item.caption.trim());
  if(!evidenced)return reject('overlap_unresolved',`${a.concept} and ${b.concept} require filing-backed evidence of separate cash-flow lines.`);
 }
 const days=(Date.parse(periodEnd+'T00:00:00Z')-Date.parse(periodStart+'T00:00:00Z'))/86400000;
 if(days<300||days>400)return reject('nonannual_period','The matched observation does not span a supported annual period.');
 return {ok:true,reason:null,detail:'Source observations reconciled; no financial methodology or derived FCF was calculated.',facts:selected};
}
