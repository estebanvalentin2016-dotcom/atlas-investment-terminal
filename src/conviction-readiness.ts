import {annualPeFromSec,deriveRankingMetrics,type MarketValuationClose,type SecCompany} from './ranking-model';

export type ReadinessStatus='verified'|'missing'|'unavailable';
export type ConvictionRequirement={key:string;label:string;status:ReadinessStatus;detail:string};
export type ConvictionAssessment={
 verdict:'INSUFFICIENT EVIDENCE';
 summary:string;
 verifiedCount:number;
 totalCount:number;
 observed:{revenueGrowthPct:number|null;freeCashFlow:number|null;fcfMarginPct:number|null;netMarginPct:number|null;fyPe:number|null;asOfDate:string|null;fiscalYear:number|null};
 requirements:ConvictionRequirement[];
};
const dateOk=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function assessConvictionReadiness(company:SecCompany|null,price:MarketValuationClose|null,today:string):ConvictionAssessment{
 const metrics=company?deriveRankingMetrics(company):null;
 const pe=company?annualPeFromSec(company,price):null;
 const financialDate=company?.metrics.find(x=>x.name==='Revenue')?.values.find(x=>x.year===metrics?.year)?.filed??null;
 const age=financialDate&&dateOk(today)&&dateOk(financialDate)?(Date.parse(today+'T00:00:00Z')-Date.parse(financialDate+'T00:00:00Z'))/86400000:null;
 const current=age!==null&&age>=0&&age<=550;
 const observedFcf=metrics?.fcf??null;
 const quoteAge=price&&dateOk(today)&&dateOk(price.sessionDate)?(Date.parse(today+'T00:00:00Z')-Date.parse(price.sessionDate+'T00:00:00Z'))/86400000:null;
 const recentClose=!!price&&price.completedSession===true&&price.feed==='IEX'&&Number.isFinite(price.price)&&price.price>0&&quoteAge!==null&&quoteAge>=0&&quoteAge<=10;
 const requirements:ConvictionRequirement[]=[
  {key:'sec-identity',label:'Real public-company SEC financial source',status:company?.source?.startsWith('https://data.sec.gov/')?'verified':'missing',detail:company?'Source: '+company.source:'No SEC financial statement loaded'},
  {key:'market-price',label:'Recent completed stock-price reference',status:recentClose?'verified':'missing',detail:recentClose?price!.sessionDate+' completed IEX close · $'+price!.price.toFixed(2):'Recent completed price unavailable; not a live quote'},
  {key:'financial-history',label:'Recent annual company financials',status:current?'verified':'missing',detail:current?'Fiscal '+metrics?.year+' · filed '+financialDate:'Recent comparable annual statements not established'},
  {key:'cash-flow',label:'Operating FCF after capital expenditure',status:current&&observedFcf!==null?'verified':'missing',detail:observedFcf!==null?'Derived SEC FY FCF · $'+observedFcf.toLocaleString('en-US'):'Need both same-period operating cash flow and capex'},
  {key:'market-cap',label:'Verified current market cap, share count and liquidity',status:'missing',detail:'Pending verified diluted-share count, corporate actions, and liquidity'},
  {key:'survival',label:'Cash runway, debt maturity, funding and dilution risk',status:'missing',detail:'Balance-sheet and financing risk engine not yet connected'},
  {key:'scenarios',label:'Four dilution-aware valuation scenarios with sensitivity',status:'missing',detail:'Bear, base, bull and moonshot per-share models not yet validated'},
  {key:'mispricing',label:'Testable market mispricing thesis and counterevidence',status:'missing',detail:'Must compare observed market expectations with independently justified assumptions'},
  {key:'durability',label:'Cited competitive durability and obsolescence research',status:'missing',detail:'Technology durability, defensibility and expansion exposure not yet assessed'},
  {key:'ownership',label:'Institutional/VC ownership with reporting dates',status:'missing',detail:'Historical backing and current disclosed holdings must remain separate'},
  {key:'monitoring',label:'Versioned thesis and explicit invalidation triggers',status:'missing',detail:'Draft notes are supported, but a validated thesis-monitoring engine is not connected'}
 ];
 return {
  verdict:'INSUFFICIENT EVIDENCE',
  summary:'A fundamental candidate is not yet a defensible investment recommendation. Price-sensitive, source-backed return scenarios and the risk evidence remain incomplete.',
  verifiedCount:requirements.filter(x=>x.status==='verified').length,
  totalCount:requirements.length,
  observed:{revenueGrowthPct:current?metrics?.growth??null:null,freeCashFlow:current?metrics?.fcf??null:null,fcfMarginPct:current?metrics?.fcfMargin??null:null,netMarginPct:current?metrics?.profitMargin??null:null,fyPe:pe?.pe??null,asOfDate:recentClose?price!.sessionDate:null,fiscalYear:current?metrics?.year??null:null},
  requirements
 };
}
