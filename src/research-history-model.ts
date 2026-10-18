import type {ScreenResult} from './autonomous-screen';
import {appendIndustryComparabilityLimitations} from './industry-classification';
import {deriveRankingMetrics,type AnnualPe,type FcfStrengthAssessment,type MarketValuationClose,type Ranked,type SecCompany,type SecIndustryClassification} from './ranking-model';

export const RESEARCH_HISTORY_MODEL_VERSION='autonomous-financial-screen-v1' as const;
export type ResearchHistoryRecordV1={
 version:1;
 assessmentModelVersion:typeof RESEARCH_HISTORY_MODEL_VERSION;
 recordId:string;
 runId:string;
 assessedAt:string;
 completionStatus:'completed_scan';
 historicalProof:'browser_local_not_tamper_proof';
 ticker:string;
 companyName:string;
 cik:string|null;
 screen:{verdict:ScreenResult['status'];reasons:string[];annualFiled:string|null;preliminaryScore:number|null};
 metrics:{fiscalYear:number|null;revenueGrowth:number|null;fcfMargin:number|null;netMargin:number|null};
 emergingStrength:FcfStrengthAssessment;
 source:{
  companyFactsUrl:string;
  companyFactsRetrievedAt:string;
  fiscalPeriodEnd:string|null;
  revenueAccession:string|null;
  classification:SecIndustryClassification|null;
 };
 valuation:{annualPe:number;eps:number;epsPeriodEnd:string;price:number;priceDate:string;provider:string;feed:string}|null;
 ranking:{score:number|null;coverage:number;factorCount:number;reasons:string[];missing:string[]}|null;
 limitations:string[];
};

export type ResearchHistoryAssessmentInput={company:SecCompany;screen:ScreenResult;emerging:FcfStrengthAssessment};
export type ResearchHistoryEnrichment={
 ticker:string;
 valuation:AnnualPe|null;
 quote:MarketValuationClose|null;
 ranking:Ranked|null;
 priceIssue:string|null;
 historyIssue:string|null;
};

const fullUtc=(value:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value));
export function createResearchHistoryRunId(completedAt:string):string{
 if(!fullUtc(completedAt))throw Error('Completed research history requires a full UTC timestamp');
 const uuid=globalThis.crypto?.randomUUID?.();
 return 'discovery-'+completedAt.replace(/[^0-9]/g,'')+'-'+(uuid||Math.random().toString(36).slice(2,14));
}

export function buildResearchHistoryRecords(input:{
 completed:boolean;
 completedAt:string;
 runId:string;
 assessments:ResearchHistoryAssessmentInput[];
 enrichments?:ResearchHistoryEnrichment[];
}):ResearchHistoryRecordV1[]{
 if(!input.completed||!fullUtc(input.completedAt)||!input.runId.trim())return [];
 const enriched=new Map((input.enrichments||[]).map(item=>[item.ticker,item]));
 return input.assessments.map((assessment,index)=>{
  const {company,screen,emerging}=assessment;
  const metrics=deriveRankingMetrics(company);
  const revenue=company.metrics.find(metric=>metric.name==='Revenue')?.values.find(value=>value.year===metrics.year);
  const extra=enriched.get(company.ticker);
  const valuation=extra?.valuation?.pe!==null&&extra?.valuation?.pe!==undefined&&extra.quote&&
   extra.valuation.eps!==null&&extra.valuation.epsEnd!==null&&extra.valuation.priceDate===extra.quote.sessionDate
   ?{annualPe:extra.valuation.pe,eps:extra.valuation.eps,epsPeriodEnd:extra.valuation.epsEnd,price:extra.quote.price,priceDate:extra.quote.sessionDate,provider:extra.quote.provider,feed:extra.quote.feed}
   :null;
  const ranking=extra?.ranking?{score:extra.ranking.score,coverage:extra.ranking.coverage,factorCount:extra.ranking.count,reasons:[...extra.ranking.reasons],missing:[...extra.ranking.missing]}:null;
  const observedLimitations=[extra?.priceIssue,extra?.historyIssue].filter((value):value is string=>Boolean(value));
  if(!extra)observedLimitations.push('Valuation and long-term price enrichment were not performed for this issuer in the bounded completed scan.');
  if(ranking?.missing.length)observedLimitations.push(...ranking.missing.map(item=>'Ranking evidence missing: '+item));
  const limitations=appendIndustryComparabilityLimitations(observedLimitations.length?observedLimitations:null,company.classification)||[];
  return {
   version:1,
   assessmentModelVersion:RESEARCH_HISTORY_MODEL_VERSION,
   recordId:input.runId+':'+String(index+1)+':'+company.ticker,
   runId:input.runId,
   assessedAt:input.completedAt,
   completionStatus:'completed_scan',
   historicalProof:'browser_local_not_tamper_proof',
   ticker:company.ticker,
   companyName:company.name,
   cik:typeof company.cik==='string'&&/^\d{10}$/.test(company.cik)?company.cik:null,
   screen:{verdict:screen.status,reasons:[...screen.reasons],annualFiled:screen.filed,preliminaryScore:screen.score},
   metrics:{fiscalYear:metrics.year,revenueGrowth:screen.growth,fcfMargin:screen.fcfMargin,netMargin:screen.netMargin},
   emergingStrength:{status:emerging.status,years:[...emerging.years],margins:[...emerging.margins]},
   source:{companyFactsUrl:company.source,companyFactsRetrievedAt:company.retrievedAt,fiscalPeriodEnd:revenue?.end??null,revenueAccession:revenue?.accession??null,classification:company.classification?{...company.classification}:null},
   valuation,
   ranking,
   limitations
  };
 });
}
