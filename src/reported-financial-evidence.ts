import {deriveRankingMetrics,type Annual,type SecCompany} from './ranking-model';

// A presentation bridge, not an input to the Discovery screen or ranking model.
// Preserve the issuer's reported spending category instead of relabeling it PP&E capex.
export function reportedFinancialEvidence(company:SecCompany){
 const metrics=deriveRankingMetrics(company);
 const revenue=company.metrics.find(metric=>metric.name==='Revenue')?.values.find(value=>value.year===metrics.year);
 const aligned=(name:string):Annual|null=>company.metrics.find(metric=>metric.name===name)?.values.find(value=>
  value.year===revenue?.year&&value.end===revenue.end&&Number.isFinite(value.value))??null;
 const operating=aligned('Operating cash flow');
 const netIncome=aligned('Net income');
 const broader=company.metrics.find(metric=>metric.name==='Capital expenditures')?.excludedBroaderFact;
 const productiveAssets=broader&&revenue&&operating&&broader.year===revenue.year&&broader.end===revenue.end&&
  broader.accession===revenue.accession&&operating.accession===revenue.accession&&Number.isFinite(broader.value)&&broader.value>=0?broader:null;
 const cashAfterProductiveAssets=productiveAssets&&operating?operating.value-productiveAssets.value:null;
 return {metrics,revenue:revenue??null,operating,netIncome,productiveAssets:productiveAssets??null,cashAfterProductiveAssets};
}
