// Transparent first-stage SEC research ranking. Not a statistically validated
// return model. Missing inputs never earn points and are ALWAYS disclosed.
export type Annual={year:number;end:string;filed:string;value:number;form:string;accession:string;tag?:string};
export type SecMetric={name:string;values:Annual[]};
export type SecCompany={ticker:string;name:string;source:string;retrievedAt:string;metrics:SecMetric[]};
export type RankWeights={growth:number;fcf:number;profit:number;pe:number};
export type RankMetrics={year:number|null;growth:number|null;fcfMargin:number|null;profitMargin:number|null;pe:number|null;fcf:number|null;revenue:number|null;capex:number|null};
export type Ranked={ticker:string;name:string;year:number|null;source:string;metrics:RankMetrics;score:number|null;coverage:number;count:number;reasons:string[];missing:string[];annualFiled:string|null};
export type MarketValuationClose={ticker:string;price:number;sessionDate:string;feed:string;provider:string;completedSession:boolean;splitValidation?:string};
export type AnnualPe={pe:number|null;eps:number|null;epsEnd:string|null;priceDate:string|null;reason:string};
export function annualPeFromSec(company:SecCompany,quote:MarketValuationClose|null):AnnualPe{
 const base={pe:null,eps:null,epsEnd:null,priceDate:quote?.sessionDate??null};
 if(!quote||quote.ticker!==company.ticker||quote.feed!=='IEX'||!quote.completedSession||!Number.isFinite(quote.price)||quote.price<=0)return {...base,reason:'Completed IEX close unavailable'};
 const rev=recent(company.metrics.find(x=>x.name==='Revenue')?.values||[])[0];
 const eps=recent(company.metrics.find(x=>x.name==='Diluted EPS')?.values||[]).find(x=>rev&&x.end===rev.end);
 if(!eps||eps.value<=0||!Number.isFinite(eps.value))return {...base,reason:'Matching positive annual diluted EPS not available'};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(eps.filed)||Date.parse(eps.filed+'T00:00:00Z')>Date.parse(quote.sessionDate+'T00:00:00Z'))return {...base,reason:'SEC EPS not yet published as of IEX close'};
 const age=Date.parse(quote.sessionDate+'T00:00:00Z')-Date.parse(eps.filed+'T00:00:00Z');
 if(!Number.isFinite(age)||age<0||age>550*86400000)return {...base,reason:'Reported annual EPS is stale'};
 const pe=Math.round(quote.price/eps.value*100)/100;
 if(!Number.isFinite(pe)||pe<=0||pe>1000)return {...base,reason:'Computed annual earnings multiple outside supported range'};
 return {pe,eps:eps.value,epsEnd:eps.end,priceDate:quote.sessionDate,reason:'Indicative fiscal-year P/E; TTM earnings and post-filing share splits not verified'};
}
export const defaultRankWeights:RankWeights={growth:30,fcf:35,profit:20,pe:15};
const finite=(n:number)=>Number.isFinite(n);
const percent=(n:number)=>Math.round(n*100)/100;
const recent=(list:Annual[])=>[...list].filter(r=>r&&finite(r.value)&&/^\d{4}-\d{2}-\d{2}$/.test(r.end)).sort((a,b)=>b.year-a.year);
const matchYear=(metric:SecMetric|undefined,year:number,periodEnd:string)=>recent(metric?.values||[]).find(x=>x.year===year&&x.end===periodEnd)?.value??null;
const cap=(n:number)=>Math.max(0,Math.min(100,n));
const normalized=(x:number,lo:number,hi:number)=>cap((x-lo)/(hi-lo)*100);
export function deriveRankingMetrics(company:SecCompany,pe:number|null=null):RankMetrics{
 const m=new Map(company.metrics.map(x=>[x.name,x]));
 const rev=recent(m.get('Revenue')?.values||[]);
 const current=rev[0];
 if(!current)return {year:null,growth:null,fcfMargin:null,profitMargin:null,pe:validPe(pe),fcf:null,revenue:null,capex:null};
 const year=current.year, revenue=current.value;
 const previous=rev.find(r=>r.year===year-1);
 const growth=previous&&previous.value>0?percent((revenue/previous.value-1)*100):null;
 const operating=matchYear(m.get('Operating cash flow'),year,current.end);
 const rawCapex=matchYear(m.get('Capital expenditures'),year,current.end);
 // SEC GAAP capex payments are normally nonnegative. Reject negative values
 // instead of silently applying the wrong cash flow sign.
 const capex=rawCapex!==null&&rawCapex>=0?rawCapex:null;
 const fcf=operating!==null&&capex!==null?operating-capex:null;
 const fcfMargin=revenue>0&&fcf!==null?percent(fcf/revenue*100):null;
 const net=matchYear(m.get('Net income'),year,current.end);
 const profitMargin=revenue>0&&net!==null?percent(net/revenue*100):null;
 return {year,growth,fcfMargin,profitMargin,pe:validPe(pe),fcf,revenue,capex};
}
function validPe(pe:number|null):number|null{return pe!==null&&finite(pe)&&pe>0&&pe<=1000?pe:null}
export function scoreCompany(company:SecCompany,weights:RankWeights,manualPe:number|null=null):Ranked{
 const metrics=deriveRankingMetrics(company,manualPe);
 const annualFiled=company.metrics.find(m=>m.name==='Revenue')?.values.find(v=>v.year===metrics.year)?.filed??null;
 const age=annualFiled?Date.now()-Date.parse(annualFiled+'T00:00:00Z'):NaN;
 const stale=!Number.isFinite(age)||age>550*86400000||age<0;
 const total=Object.values(weights).reduce((sum,n)=>sum+(finite(n)&&n>0?n:0),0);
 const points:{key:keyof RankWeights;value:number|null;grade:number}[]=[
  {key:'growth',value:metrics.growth,grade:metrics.growth===null?0:normalized(metrics.growth,-10,35)},
  {key:'fcf',value:metrics.fcfMargin,grade:metrics.fcfMargin===null?0:normalized(metrics.fcfMargin,-5,25)},
  {key:'profit',value:metrics.profitMargin,grade:metrics.profitMargin===null?0:normalized(metrics.profitMargin,-5,25)},
  {key:'pe',value:metrics.pe,grade:metrics.pe===null?0:metrics.pe<=0?0:cap((60-metrics.pe)/55*100)}
 ];
 const active=points.filter(p=>weights[p.key]>0);
 const observed=active.filter(p=>p.value!==null);
 const evidenceWeight=observed.reduce((sum,p)=>sum+weights[p.key],0);
 const coverage=total>0?percent(evidenceWeight/total*100):0;
 const missing:string[]=active.filter(p=>p.value===null).map(p=>p.key==='growth'?'Revenue growth':p.key==='fcf'?'FCF margin':p.key==='profit'?'Net margin':'Automatic FY P/E');
 const reasons=observed.map(p=>(p.key==='growth'?'Revenue growth':p.key==='fcf'?'Free cash flow margin':p.key==='profit'?'Net margin':'SEC earnings / IEX close FY P/E')+': '+(p.value===null?'unknown':p.value.toFixed(2))+(p.key==='pe'?'x':'%'));
 if(metrics.year===null)missing.push('SEC fiscal-year revenue');
 if(stale)missing.push('Fresh SEC fiscal financials');
 const hasCore=observed.filter(p=>p.key!=='pe').length>=2;
 const eligible=total>0&&coverage>=60&&hasCore&&metrics.year!==null&&!stale;
 // Missing factors get ZERO weighted credit, not a perfect score.
 const score=eligible?Math.round(observed.reduce((sum,p)=>sum+p.grade*weights[p.key],0)/total):null;
 return {ticker:company.ticker,name:company.name,year:metrics.year,source:company.source,metrics,score,coverage,count:observed.length,reasons,missing,annualFiled};
}
export function rankCompanies(data:SecCompany[],weights:RankWeights,pe:Record<string,number|null>={}):Ranked[]{
 return data.map(c=>scoreCompany(c,weights,pe[c.ticker]??null)).sort((a,b)=>(b.score??-1)-(a.score??-1)||b.coverage-a.coverage||a.ticker.localeCompare(b.ticker));
}
