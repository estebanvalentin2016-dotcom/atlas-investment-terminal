import type {SecCompany} from './ranking-model';
import {mapSecIndustry} from './industry-classification';

export type FinancialMethodologyStatus='provisional_operating'|'financial_institution'|'mixed_financing_review'|'unknown';
export type FinancialMethodologyEligibility={status:FinancialMethodologyStatus;reason:string;source:string|null};

// Filing-bound observations, not a general-purpose financing-subsidiary detector.
// An unresolved issuer remains under review after this filing; a later filing
// does not silently certify that the financing operation disappeared.
const MIXED_FINANCING_EVIDENCE:Record<string,{filed:string;accession:string;concept:string;value:number;url:string}>={
 '0000018230':{filed:'2026-02-13',accession:'0000018230-26-000008',concept:'PaymentsToAcquireFinanceReceivables',value:15329000000,url:'https://www.sec.gov/Archives/edgar/data/18230/000001823026000008/cat-20251231.htm'},
 '0000037996':{filed:'2026-02-10',accession:'0000037996-26-000015',concept:'PaymentsToAcquireLoansAndLeasesHeldForInvestment',value:55747000000,url:'https://www.sec.gov/Archives/edgar/data/37996/000003799626000015/f-20251231.htm'}
};

export function assessFinancialMethodologyEligibility(company:SecCompany,asOf:string):FinancialMethodologyEligibility{
 const classification=company.classification;
 const source=classification?.source??null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf+'T00:00:00Z')))
  return {status:'unknown',reason:'A valid assessment date is required to establish methodology eligibility.',source};
 if(!/^\d{10}$/.test(company.cik??'')||company.source!==`https://data.sec.gov/api/xbrl/companyfacts/CIK${company.cik}.json`)
  return {status:'unknown',reason:'SEC issuer identity and Company Facts provenance are not established.',source:company.source||null};
 if(!classification||classification.status!=='reported'||classification.retrievedAt.slice(0,10)>asOf||
   classification.source!==`https://data.sec.gov/submissions/CIK${company.cik}.json`)
  return {status:'unknown',reason:'As-of-date SEC-reported industry classification is unavailable or unverified.',source};
 const family=mapSecIndustry(classification);
 if(family==='bank'||family==='insurance_carrier'||family==='insurance_broker_services')
  return {status:'financial_institution',reason:`SEC SIC ${classification.code} (${classification.description}) identifies a specialized financial business; ordinary-company FCF screening is unsuitable.`,source};
 const mixed=MIXED_FINANCING_EVIDENCE[company.cik!];
 if(mixed&&mixed.filed<=asOf)return {status:'mixed_financing_review',reason:`An original 10-K filed ${mixed.filed} (accession ${mixed.accession}) reports ${mixed.concept} of USD ${mixed.value}. Operating/financing cash-flow comparability remains unresolved; later filings require review.`,source:mixed.url};
 if(family!=='other_recognized_sic')return {status:'unknown',reason:'SEC SIC does not establish ordinary-company methodology eligibility.',source};
 return {status:'provisional_operating',reason:`SEC SIC ${classification.code} (${classification.description}) supports only provisional ordinary-company PP&E-only assessment. SIC does not establish investment-spending completeness or full accounting comparability.`,source};
}

export const PP_AND_E_FCF_DISCLOSURE='ATLAS-derived FCF: operating cash flow less reported PP&E cash purchases. This non-GAAP calculation may exclude software development, intangible investment, acquisitions, financing-related asset payments, and other investment spending; separately reported software spending is not included. It is not cash proven freely available to shareholders.';
