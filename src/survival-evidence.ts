// Dated SEC annual balance-sheet observations. This is NOT a credit model,
// a complete debt schedule or a dilution-adjusted share valuation.
import type {Annual,SecCompany,SecMetric} from './ranking-model';

export type SourcedFigure={value:number;fiscalEnd:string;filed:string;tag:string|null;accession:string|null};
export type SurvivalEvidence={
 fiscalYear:number|null;fiscalEnd:string|null;cash:SourcedFigure|null;
 currentDebt:SourcedFigure|null;noncurrentDebt:SourcedFigure|null;shortBorrowings:SourcedFigure|null;
 weightedDilutedShares:SourcedFigure|null;previousWeightedDilutedShares:SourcedFigure|null;
 weightedShareChangePct:number|null;freeCashFlow:number|null;simpleCashToBurnYears:number|null;
 missing:string[];notes:string[];source:string;
};
const validDay=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const round=(v:number)=>Math.round(v*100)/100;
function eligible(row:Annual,asOf:string){
 return validDay(row.end)&&validDay(row.filed)&&row.end<=asOf&&row.filed<=asOf&&Number.isFinite(row.value);
}
function observation(metric:SecMetric|undefined,fiscalEnd:string,asOf:string,allowNegative=false):SourcedFigure|null{
 const item=metric?.values.filter(row=>row.end===fiscalEnd&&eligible(row,asOf)&&(allowNegative||row.value>=0)).sort((a,b)=>b.filed.localeCompare(a.filed))[0];
 return item?{value:item.value,fiscalEnd:item.end,filed:item.filed,tag:metric?.tag??item.tag??null,accession:item.accession??null}:null;
}
export function deriveSurvivalEvidence(company:SecCompany,asOf:string):SurvivalEvidence{
 const metrics=new Map(company.metrics.map(m=>[m.name,m]));
 const revenue=(metrics.get('Revenue')?.values??[]).filter(r=>validDay(r.end)&&validDay(r.filed)&&r.filed<=asOf&&r.end<=asOf)
  .sort((a,b)=>b.end.localeCompare(a.end))[0];
 const end=revenue?.end??null;
 const empty={fiscalYear:null,fiscalEnd:null,cash:null,currentDebt:null,noncurrentDebt:null,shortBorrowings:null,
  weightedDilutedShares:null,previousWeightedDilutedShares:null,weightedShareChangePct:null,freeCashFlow:null,
  simpleCashToBurnYears:null,missing:['Comparable SEC annual revenue period unavailable as of '+asOf],
  notes:['Do not infer financial health from missing SEC tags or from a future filing.'],source:company.source} satisfies SurvivalEvidence;
 if(!end||!validDay(asOf))return empty;
 const cash=observation(metrics.get('Cash and cash equivalents'),end,asOf);
 const currentDebt=observation(metrics.get('Current portion of long-term debt'),end,asOf);
 const noncurrentDebt=observation(metrics.get('Long-term debt noncurrent'),end,asOf);
 const shortBorrowings=observation(metrics.get('Short-term borrowings'),end,asOf);
 const weightedDilutedShares=observation(metrics.get('Weighted-average diluted shares'),end,asOf);
 const previous=(metrics.get('Weighted-average diluted shares')?.values??[]).filter(r=>r.year===revenue.year-1&&eligible(r,asOf)&&r.value>=0)
  .sort((a,b)=>b.filed.localeCompare(a.filed))[0];
 const previousWeightedDilutedShares=previous?{value:previous.value,fiscalEnd:previous.end,filed:previous.filed,tag:metrics.get('Weighted-average diluted shares')?.tag??previous.tag??null,accession:previous.accession??null}:null;
 const weightedShareChangePct=weightedDilutedShares&&previousWeightedDilutedShares&&previousWeightedDilutedShares.value>0?
  round((weightedDilutedShares.value/previousWeightedDilutedShares.value-1)*100):null;
 // Source matched to the same fiscal period and *actually filed by* asOf.
 // Historical SEC restatements received later cannot leak into old snapshots.
 const opCash=observation(metrics.get('Operating cash flow'),end,asOf,true);
 const capex=observation(metrics.get('Capital expenditures'),end,asOf);
 const fcf=opCash&&capex?opCash.value-capex.value:null;
 const simpleCashToBurnYears=cash&&fcf!==null&&fcf<0?round(cash.value/-fcf):null;
 const missing:string[]=[];
 if(!cash)missing.push('Same-period unrestricted cash and cash equivalents');
 if(!currentDebt||!noncurrentDebt||!shortBorrowings)missing.push('Full current/noncurrent debt, short borrowings and maturity schedule');
 if(!weightedDilutedShares)missing.push('Annual weighted-average diluted share count');
 if(weightedShareChangePct===null)missing.push('Comparable preceding-year diluted share count');
 if(fcf===null)missing.push('Same-year cash flow after capital expenditure');
 const notes=[
  'Debt components are displayed separately: missing tags never mean zero debt, and their sum is not complete total liabilities.',
  'Weighted-average diluted shares are NOT the currently outstanding shares. Their year-over-year change is only a proxy for dilution; stock splits, buybacks and share classes may distort it.',
  'Cash divided by negative historical FCF, if displayed, is a mechanical sensitivity, NOT a forecast of cash runway or access to financing.',
  '10-K observations use fiscal period end and public filing date. Quarterly changes, debt maturities, market cap and future dilution still require research.'
 ];
 return {fiscalYear:revenue.year,fiscalEnd:end,cash,currentDebt,noncurrentDebt,shortBorrowings,
  weightedDilutedShares,previousWeightedDilutedShares,weightedShareChangePct,
  freeCashFlow:fcf,simpleCashToBurnYears,missing,notes,source:company.source};
}
