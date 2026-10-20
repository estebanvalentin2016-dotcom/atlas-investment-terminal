import {normalizeSecFinancialFacts} from './sec-financial-normalization.mjs';

// Evidence inventory only. It does not calculate FCF or approve filing captions.
export const SEC_FCF_MANIFEST_VERSION='sec-fcf-evidence-manifest-v1';
const MAX_FACTS=80;
const GROUPS={
 operatingCashFlow:['NetCashProvidedByUsedInOperatingActivities','NetCashProvidedByUsedInOperatingActivitiesContinuingOperations','CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations'],
 cashPurchases:['PaymentsToAcquirePropertyPlantAndEquipment','PaymentsToAcquireProductiveAssets','PaymentsToDevelopSoftware','PaymentsToAcquireIntangibleAssets'],
 possibleFinancingAssetPayments:['FinanceLeasePrincipalPayments'],
 mixedBusinessIndicators:['PaymentsToAcquireFinanceReceivables','PaymentsToAcquireLoansAndLeasesHeldForInvestment','PaymentsToAcquireEquipmentOnLease'],
 contextualFacts:['PaymentsForProceedsFromProductiveAssets','CapitalizedComputerSoftwareAdditions','IncomeLossFromDiscontinuedOperationsNetOfTaxAttributableToReportingEntity']
};
const CONCEPTS=[...new Set(Object.values(GROUPS).flat())];
const PURCHASES=new Set(GROUPS.cashPurchases);
const COMPONENTS=new Set(GROUPS.cashPurchases.filter(x=>x!=='PaymentsToAcquireProductiveAssets'));
const isoDay=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
 !Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const accession=x=>typeof x==='string'&&/^\d{10}-\d{2}-\d{6}$/.test(x);
const note=(code,detail,facts=[])=>({code,detail,concepts:[...new Set(facts.map(x=>x.concept))]});
const filingRows=submissions=>{
 const recent=submissions?.filings?.recent;
 if(!Array.isArray(recent?.accessionNumber))return [];
 return recent.accessionNumber.map((number,index)=>({
  accession:number,form:recent.form?.[index]??null,reportDate:recent.reportDate?.[index]??null,
  filedDate:recent.filingDate?.[index]??null,acceptedAt:recent.acceptanceDateTime?.[index]??null,
  primaryDocument:recent.primaryDocument?.[index]??null
 }));
};
const filingUrl=(cik,row)=>row&&/^[A-Za-z0-9._-]+$/.test(row.primaryDocument||'')?
 `https://www.sec.gov/Archives/edgar/data/${cik}/${row.accession.replaceAll('-','')}/${row.primaryDocument}`:null;
const distinct=items=>[...new Set(items)];

/** Build one accession-bound manifest from SEC Company Facts and submissions. */
export function buildSecFcfEvidenceManifestV1({companyFacts,submissions,cik,filingAccession,asOfDate,retrievedAt=null,filingLineObservations=[]}){
 if(!Number.isSafeInteger(cik)||cik<=0||!accession(filingAccession)||!isoDay(asOfDate))
  return {ok:false,reason:'invalid_request',detail:'A resolved CIK, filing accession, and UTC assessment date are required.'};
 if(companyFacts?.cik!==cik||Number(submissions?.cik)!==cik)
  return {ok:false,reason:'issuer_mismatch',detail:'Company Facts and submissions must identify the same resolved CIK.'};
 const rows=filingRows(submissions),filing=rows.find(row=>row.accession===filingAccession);
 if(!filing)return {ok:false,reason:'filing_not_found',detail:'The requested accession is absent from the supplied SEC submissions listing.'};
 const url=filingUrl(cik,filing);
 const normalized=normalizeSecFinancialFacts(companyFacts,{cik,concepts:CONCEPTS,filingUrls:url?{[filingAccession]:url}:{}});
 const accessionFacts=normalized.filter(fact=>fact.accession===filingAccession);
 const periodEnd=isoDay(filing.reportDate)?filing.reportDate:null;
 const operating=accessionFacts.filter(fact=>GROUPS.operatingCashFlow.includes(fact.concept)&&fact.periodEnd===periodEnd);
 const starts=distinct(operating.map(fact=>fact.periodStart));
 const periodStart=starts.length===1?starts[0]:null;
 const fiscalYears=distinct(operating.map(fact=>fact.fiscalYear));
 const fiscalYear=fiscalYears.length===1?fiscalYears[0]:null;
 const selected=periodStart&&periodEnd?accessionFacts.filter(fact=>fact.periodStart===periodStart&&fact.periodEnd===periodEnd):[];
 // Annual filings normally include prior-year columns under the same accession.
 // Preserve those comparatives, but never use them as target-period inputs.
 const historicalComparatives=periodEnd?accessionFacts.filter(fact=>fact.periodEnd<periodEnd):[];
 const incompatible=periodEnd?accessionFacts.filter(fact=>
  fact.periodEnd>periodEnd||(fact.periodEnd===periodEnd&&fact.periodStart!==periodStart)||
  (selected.includes(fact)&&fiscalYear!==null&&fact.fiscalYear!==fiscalYear)):[];
 const samePeriod=periodStart&&periodEnd?normalized.filter(fact=>fact.accession!==filingAccession&&fact.periodStart===periodStart&&fact.periodEnd===periodEnd):[];
 const relatedFilings=rows.filter(row=>row.accession!==filingAccession&&row.reportDate===filing.reportDate&&['10-K','10-K/A'].includes(row.form));
 const issues=[];
 if(!url)issues.push(note('filing_url_missing','SEC submissions did not identify a usable primary filing document.'));
 if(!isoDay(filing.filedDate))issues.push(note('filing_date_missing','A valid SEC filing date was not supplied.'));
 const acceptedAt=typeof filing.acceptedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(filing.acceptedAt)&&
  !Number.isNaN(Date.parse(filing.acceptedAt))?filing.acceptedAt:null;
 if(!acceptedAt)issues.push(note('acceptance_time_unknown','The SEC acceptance timestamp was unavailable; filing-day eligibility cannot be resolved precisely.'));
 else if(Date.parse(acceptedAt)>Date.parse(asOfDate+'T23:59:59.999Z'))issues.push(note('not_available_as_of','This filing was accepted after the requested assessment day.'));
 if(selected.some(fact=>fact.filedDate>asOfDate))issues.push(note('fact_not_available_as_of','At least one selected fact was filed after the requested assessment day.'));
 if(selected.some(fact=>fact.form!==filing.form||fact.filedDate!==filing.filedDate))
  issues.push(note('filing_metadata_conflict','Company Facts form or filing date differs from the selected submissions record.'));
 if(starts.length!==1||fiscalYears.length!==1||fiscalYear===null)
  issues.push(note('operating_period_unverified','The selected filing has no unique annual operating-cash-flow period and fiscal-year designation.',operating));
 if(incompatible.length)issues.push(note('incompatible_period','Some target-period observations conflict on fiscal dates or fiscal-year designation.',incompatible));
 if(!selected.some(fact=>GROUPS.operatingCashFlow.includes(fact.concept)))issues.push(note('operating_cash_flow_missing','No compatible annual operating-cash-flow observation was available.'));
 const purchases=selected.filter(fact=>PURCHASES.has(fact.concept));
 if(!purchases.length)issues.push(note('cash_purchase_fact_missing','No supported cash-purchase concept was reported for this annual period.'));
 if(purchases.some(fact=>fact.concept==='PaymentsToAcquireProductiveAssets')&&purchases.some(fact=>COMPONENTS.has(fact.concept)))
  issues.push(note('aggregate_component_overlap','An aggregate and one or more potentially included components coexist; never add them together.',purchases));
 if(purchases.some(fact=>fact.concept==='PaymentsToDevelopSoftware')&&purchases.some(fact=>fact.concept==='PaymentsToAcquireIntangibleAssets'))
  issues.push(note('software_intangible_overlap_review','Software and intangible concepts may overlap; a reported zero is evidence, not a missing component.',purchases));
 for(const concept of COMPONENTS)if(!selected.some(fact=>fact.concept===concept))
  issues.push(note('component_coverage_unknown',`${concept} was not observed in Company Facts for this filing; absence is not reported zero.`));
 const duplicates=Object.values(Object.groupBy(selected,fact=>fact.concept)).filter(group=>group.length>1);
 for(const group of duplicates)issues.push(note(distinct(group.map(fact=>fact.value)).length>1?'conflicting_facts':'duplicate_observation','Repeated same-concept observations require reconciliation.',group));
 if(relatedFilings.some(row=>row.form==='10-K/A')||samePeriod.some(fact=>fact.form==='10-K/A'))
  issues.push(note('amendment_requires_review','A related amended annual filing exists; no amended fact is selected silently.'));
 if(samePeriod.some(fact=>selected.some(chosen=>chosen.concept===fact.concept&&chosen.value!==fact.value)))
  issues.push(note('restatement_conflict','Another filing reports a different value for the same period and concept.',samePeriod));
 const discontinued=selected.filter(fact=>['CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations','IncomeLossFromDiscontinuedOperationsNetOfTaxAttributableToReportingEntity'].includes(fact.concept)&&fact.value!==0);
 if(discontinued.length)issues.push(note('discontinued_operations_scope','Nonzero discontinued-operation facts require scope-aligned cash-flow and spending review.',discontinued));
 const finance=selected.filter(fact=>GROUPS.mixedBusinessIndicators.includes(fact.concept)&&fact.value!==0);
 if(finance.length)issues.push(note('possible_financing_business','Finance-receivable or leased-equipment cash flows suggest a mixed operating/financing business; SIC alone is insufficient.',finance));
 const sic=String(submissions.sic??'');
 if(/^\d{4}$/.test(sic)&&Number(sic)>=6000&&Number(sic)<7000)
  issues.push(note('unsupported_financial_sector','SEC SIC identifies a financial/real-estate family needing a separate methodology.'));
 const funding=selected.filter(fact=>GROUPS.possibleFinancingAssetPayments.includes(fact.concept));
 if(funding.length)issues.push(note('financing_asset_payment_review','Financing cash payments may relate to productive assets but are not automatically capital expenditures.',funding));
 const suppliedLines=[];
 for(const line of filingLineObservations){
  if(url&&line?.filingUrl===url&&line.accession===filingAccession&&line.section==='financing'&&
   typeof line.caption==='string'&&line.caption.trim()&&Number.isSafeInteger(line.value)&&line.value>=0&&line.unit==='USD')
   suppliedLines.push({...line,provenanceMode:'caller_supplied_filing_excerpt_unverified'});
  else issues.push(note('invalid_filing_line','A supplied filing-line observation was incomplete or not bound to this accession.'));
 }
 if(suppliedLines.length)issues.push(note('filing_excerpt_review','Caller-supplied filing captions are preserved but not independently verified by this API.'));
 if(suppliedLines.length)issues.push(note('financing_asset_payment_review','Caller-supplied financing-section payments may be relevant but require filing review.'));
 if(!sic||!/^\d{4}$/.test(sic))issues.push(note('industry_unverified','SEC submissions did not provide a valid four-digit SIC.'));
 issues.push(note('caption_and_completeness_review','SEC tags alone do not establish cash-flow section, economic equivalence, or complete productive spending.'));
 const overflow=selected.length+samePeriod.length>MAX_FACTS||historicalComparatives.length>MAX_FACTS||
  incompatible.length>MAX_FACTS||relatedFilings.length>MAX_FACTS||suppliedLines.length>MAX_FACTS;
 if(overflow)issues.push(note('manifest_truncated','The bounded evidence output is incomplete; it must not feed a calculation.'));
 const unusableContext=new Set(['not_available_as_of','fact_not_available_as_of','filing_metadata_conflict','filing_date_missing',
  'operating_period_unverified','incompatible_period','manifest_truncated']);
 const group=name=>selected.filter(fact=>GROUPS[name].includes(fact.concept)).slice(0,MAX_FACTS);
 const source={companyFactsUrl:`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10,'0')}.json`,submissionsUrl:`https://data.sec.gov/submissions/CIK${String(cik).padStart(10,'0')}.json`,retrievedAt};
 return {
  ok:true,version:SEC_FCF_MANIFEST_VERSION,status:'review_required',cik,reportingEntity:companyFacts.entityName??null,
  accession:filingAccession,filing:{...filing,url,acceptedAt},period:{start:periodStart,end:periodEnd,fiscalYear,currency:'USD'},asOfDate,source,
  secClassification:/^\d{4}$/.test(sic)?{status:'reported',code:sic,description:submissions.sicDescription??null,sourceUrl:source.submissionsUrl}:{status:'unavailable',code:null,description:null,sourceUrl:source.submissionsUrl},
  observations:{operatingCashFlow:group('operatingCashFlow'),cashPurchases:group('cashPurchases'),possibleFinancingAssetPayments:funding.slice(0,MAX_FACTS),
   mixedBusinessIndicators:finance.slice(0,MAX_FACTS),contextualFacts:group('contextualFacts'),reportedZeros:selected.filter(fact=>fact.value===0).slice(0,MAX_FACTS),
   historicalComparatives:historicalComparatives.slice(0,MAX_FACTS),
   incompatiblePeriod:incompatible.slice(0,MAX_FACTS),samePeriodOtherFilings:samePeriod.slice(0,MAX_FACTS),
   callerSuppliedFilingLines:suppliedLines.slice(0,MAX_FACTS)},
  relatedFilings:relatedFilings.slice(0,MAX_FACTS),reviewRequired:issues,
  candidateContext:!periodStart||!periodEnd||issues.some(issue=>unusableContext.has(issue.code))?null:
   {facts:[...selected,...samePeriod].slice(0,MAX_FACTS),cik,periodStart,periodEnd,asOfDate}
 };
}
