import type {SecIndustryClassification} from './ranking-model';

export type IndustryResearchFamily='insurance_carrier'|'insurance_broker_services'|'bank'|'other_recognized_sic'|'unknown';

const INSURANCE_CARRIER_SICS=new Set(['6311','6321','6324','6331','6351','6361','6371','6399']);
const BANK_SICS=new Set(['6021','6022','6029','6035','6036','6061','6062','6081','6082','6099']);

export function mapSecIndustry(classification:SecIndustryClassification|undefined):IndustryResearchFamily{
 if(!classification||classification.status!=='reported'||!/^\d{4}$/.test(classification.code))return 'unknown';
 if(INSURANCE_CARRIER_SICS.has(classification.code))return 'insurance_carrier';
 if(classification.code==='6411')return 'insurance_broker_services';
 if(BANK_SICS.has(classification.code))return 'bank';
 return 'other_recognized_sic';
}

const provenance=(classification:Extract<SecIndustryClassification,{status:'reported'}>)=>
 `SEC SIC ${classification.code} (${classification.description}), retrieved ${classification.retrievedAt}. Source: ${classification.source}`;

export function industryComparabilityLimitations(classification:SecIndustryClassification|undefined):string[]{
 const family=mapSecIndustry(classification);
 if(!classification||classification.status==='unavailable'||family==='unknown'){
  const source=classification?.source||'the SEC submissions endpoint';
  const retrieved=classification?.retrievedAt?` as of ${classification.retrievedAt}`:'';
  return [`SEC industry classification was unavailable from ${source}${retrieved}; comparability of the generic financial screen has not been established.`];
 }
 const source=provenance(classification);
 if(family==='insurance_carrier')return [`${source} This identifies an insurance carrier. Generic revenue growth, operating FCF margin, indicative FY P/E, and sampled debt components do not verify underwriting quality, reserve adequacy, reinsurance exposure, statutory capital, or investment-portfolio risk.`];
 if(family==='insurance_broker_services')return [`${source} This identifies an insurance broker/services business. Generic revenue growth, operating FCF margin, indicative FY P/E, and sampled debt components do not distinguish organic growth from acquisitions or reconcile retention, acquisition accounting, earn-outs, intangible amortization, and acquisition-related leverage.`];
 if(family==='bank')return [`${source} This identifies a bank or depository institution. Generic revenue, operating FCF, P/E, and sampled debt measures are not substitutes for net interest margin, deposit quality, credit losses, regulatory capital, liquidity, or asset-quality analysis.`];
 return [];
}

export function appendIndustryComparabilityLimitations(existing:string[]|null,classification:SecIndustryClassification|undefined):string[]|null{
 const combined=[...(existing||[]),...industryComparabilityLimitations(classification)];
 return combined.length?combined:null;
}
