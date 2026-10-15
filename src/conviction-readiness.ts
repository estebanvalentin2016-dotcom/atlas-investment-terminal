import {annualPeFromSec,deriveRankingMetrics,type MarketValuationClose,type SecCompany} from './ranking-model';
import {deriveSurvivalEvidence} from './survival-evidence';
import {deriveMarketCapEvidence} from './market-cap-evidence';

export type ReadinessStatus='verified'|'missing'|'unavailable';
export type ConvictionRequirement={key:string;label:string;status:ReadinessStatus;detail:string;progress:'verified'|'partially_sourced'|'engine_pending'|'source_unavailable'};
export type FundingRiskEvidence={status:'growth_with_negative_fcf'|'negative_fcf'|'nonnegative_fcf'|'unknown';headline:string;detail:string};
export type ConvictionAssessment={
 fundingRisk:FundingRiskEvidence;
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
 const growth=current?metrics?.growth??null:null;
 const annualFcf=current?metrics?.fcf??null:null;
 const fundingRisk:FundingRiskEvidence=annualFcf===null?
  {status:'unknown',headline:'Funding needs not established',detail:'Missing comparable annual cash-flow after capital expenditures. No funding conclusion is possible.'}:
  annualFcf<0?{
   status:growth!==null&&growth>0?'growth_with_negative_fcf':'negative_fcf',
   headline:growth!==null&&growth>0?'Growth with negative free cash flow':'Negative annual free cash flow',
   detail:'Negative reported annual FCF after capex; reconcile expansion capex, operating cash consumption, working capital, available cash, debt maturities and potential share issuance. It does not prove distress or productive reinvestment.'
  }:
  {status:'nonnegative_fcf',headline:'Nonnegative reported annual free cash flow',detail:'Nonnegative annual FCF does not establish cash runway, fully funded growth or an attractive equity valuation.'};
 const capital=deriveMarketCapEvidence(company,recentClose?price:null,today);
 const survival=company?deriveSurvivalEvidence(company,recentClose?price!.sessionDate:today):null;
 const survivalNote=survival?'Annual SEC cash: '+(survival.cash?'$'+survival.cash.value.toLocaleString('en-US'):'not observed')+'; sampled debt fields disclosed: '+[survival.currentDebt,survival.noncurrentDebt,survival.shortBorrowings].filter(Boolean).length+' of 3 (unreported fields do NOT imply zero debt); weighted-average diluted-share trend: '+(survival.weightedShareChangePct===null?'unknown':survival.weightedShareChangePct.toFixed(2)+'%')+'. Full debt maturities, quarterly liquidity and prospective financing are NOT assessed.':'Source-backed balance-sheet and financing-risk observations not loaded';
 const requirements:ConvictionRequirement[]=[
  {key:'sec-identity',progress:company?.source?.startsWith('https://data.sec.gov/')?'verified':'source_unavailable',label:'Real public-company SEC financial source',status:company?.source?.startsWith('https://data.sec.gov/')?'verified':'missing',detail:company?'Source: '+company.source:'No SEC financial statement loaded'},
  {key:'market-price',progress:recentClose?'verified':'source_unavailable',label:'Recent completed stock-price reference',status:recentClose?'verified':'missing',detail:recentClose?price!.sessionDate+' completed IEX close · $'+price!.price.toFixed(2):'Recent completed price unavailable; not a live quote'},
  {key:'financial-history',progress:current?'verified':'source_unavailable',label:'Recent annual company financials',status:current?'verified':'missing',detail:current?'Fiscal '+metrics?.year+' · filed '+financialDate:'Recent comparable annual statements not established'},
  {key:'cash-flow',progress:current&&observedFcf!==null?'verified':'source_unavailable',label:'Operating FCF after capital expenditure',status:current&&observedFcf!==null?'verified':'missing',detail:observedFcf!==null?'Derived SEC FY FCF · $'+observedFcf.toLocaleString('en-US'):'Need both same-period operating cash flow and capex'},
  {key:'market-cap',progress:capital.estimate!==null?'partially_sourced':'engine_pending',label:'Verified current market cap, share count and liquidity',status:'missing',detail:capital.estimate!==null?'Indicative only: SEC DEI shares as of '+capital.shares?.end+' (filed '+capital.shares?.filed+') × completed IEX close '+capital.priceDate+' = 
  {key:'survival',progress:survival&&(survival.cash||survival.weightedDilutedShares||survival.currentDebt||survival.noncurrentDebt||survival.shortBorrowings)?'partially_sourced':'engine_pending',label:'Cash runway, debt maturity, funding and dilution risk',status:'missing',detail:survivalNote},
  {key:'scenarios',progress:'engine_pending',label:'Four dilution-aware valuation scenarios with sensitivity',status:'missing',detail:'ATLAS scenario engine not built: must model five-year revenue, margins, capex, debt, new financing, share dilution, exit values and downside before forecasting per-share returns'},
  {key:'mispricing',progress:'engine_pending',label:'Testable market mispricing thesis and counterevidence',status:'missing',detail:'ATLAS mispricing analysis not connected: compare today\'s dated share price and valuation with explicit, falsifiable future business assumptions and counterevidence'},
  {key:'durability',progress:'engine_pending',label:'Cited competitive durability and obsolescence research',status:'missing',detail:'ATLAS competitive-research integration not connected: source product/industry filings, customer exposure, switching costs, substitution threats and AI-infrastructure beneficiaries'},
  {key:'ownership',progress:'engine_pending',label:'Institutional/VC ownership with reporting dates',status:'missing',detail:'Institutional 13F/consensus dashboards exist, but ATLAS has not yet resolved this issuer\'s CUSIP, manager affiliations, reporting delays and independent active holdings within the Conviction Lab'},
  {key:'monitoring',progress:'partially_sourced',label:'Versioned thesis and explicit invalidation triggers',status:'missing',detail:'Timestamped manual thesis drafts work now; automatic filing/price monitoring, evidence-triggered invalidation, version comparisons and alerts are not connected'}
 ];
 return {
  fundingRisk,
  verdict:'INSUFFICIENT EVIDENCE',
  summary:'A fundamental candidate is not yet a defensible investment recommendation. Price-sensitive, source-backed return scenarios and the risk evidence remain incomplete.',
  verifiedCount:requirements.filter(x=>x.status==='verified').length,
  totalCount:requirements.length,
  observed:{revenueGrowthPct:current?metrics?.growth??null:null,freeCashFlow:current?metrics?.fcf??null:null,fcfMarginPct:current?metrics?.fcfMargin??null:null,netMarginPct:current?metrics?.profitMargin??null:null,fyPe:pe?.pe??null,asOfDate:recentClose?price!.sessionDate:null,fiscalYear:current?metrics?.year??null:null},
  requirements
 };
}
+capital.estimate.toLocaleString('en-US')+'. IEX 20-session turnover: '+(capital.iex20?'
  {key:'survival',progress:survival&&(survival.cash||survival.weightedDilutedShares||survival.currentDebt||survival.noncurrentDebt||survival.shortBorrowings)?'partially_sourced':'engine_pending',label:'Cash runway, debt maturity, funding and dilution risk',status:'missing',detail:survivalNote},
  {key:'scenarios',progress:'engine_pending',label:'Four dilution-aware valuation scenarios with sensitivity',status:'missing',detail:'ATLAS scenario engine not built: must model five-year revenue, margins, capex, debt, new financing, share dilution, exit values and downside before forecasting per-share returns'},
  {key:'mispricing',progress:'engine_pending',label:'Testable market mispricing thesis and counterevidence',status:'missing',detail:'ATLAS mispricing analysis not connected: compare today\'s dated share price and valuation with explicit, falsifiable future business assumptions and counterevidence'},
  {key:'durability',progress:'engine_pending',label:'Cited competitive durability and obsolescence research',status:'missing',detail:'ATLAS competitive-research integration not connected: source product/industry filings, customer exposure, switching costs, substitution threats and AI-infrastructure beneficiaries'},
  {key:'ownership',progress:'engine_pending',label:'Institutional/VC ownership with reporting dates',status:'missing',detail:'Institutional 13F/consensus dashboards exist, but ATLAS has not yet resolved this issuer\'s CUSIP, manager affiliations, reporting delays and independent active holdings within the Conviction Lab'},
  {key:'monitoring',progress:'partially_sourced',label:'Versioned thesis and explicit invalidation triggers',status:'missing',detail:'Timestamped manual thesis drafts work now; automatic filing/price monitoring, evidence-triggered invalidation, version comparisons and alerts are not connected'}
 ];
 return {
  fundingRisk,
  verdict:'INSUFFICIENT EVIDENCE',
  summary:'A fundamental candidate is not yet a defensible investment recommendation. Price-sensitive, source-backed return scenarios and the risk evidence remain incomplete.',
  verifiedCount:requirements.filter(x=>x.status==='verified').length,
  totalCount:requirements.length,
  observed:{revenueGrowthPct:current?metrics?.growth??null:null,freeCashFlow:current?metrics?.fcf??null:null,fcfMarginPct:current?metrics?.fcfMargin??null:null,netMarginPct:current?metrics?.profitMargin??null:null,fyPe:pe?.pe??null,asOfDate:recentClose?price!.sessionDate:null,fiscalYear:current?metrics?.year??null:null},
  requirements
 };
}
+capital.iex20.avgDailyIexDollarVolume.toLocaleString('en-US'):'unavailable')+'. Share classes, splits, float and consolidated liquidity remain unverified.':'No date-compatible SEC DEI shares and completed price available for an indicative market cap. '+capital.notes.join(' ')+' Current share classes, corporate actions, free float and consolidated liquidity are still unverified.'},
  {key:'survival',progress:survival&&(survival.cash||survival.weightedDilutedShares||survival.currentDebt||survival.noncurrentDebt||survival.shortBorrowings)?'partially_sourced':'engine_pending',label:'Cash runway, debt maturity, funding and dilution risk',status:'missing',detail:survivalNote},
  {key:'scenarios',progress:'engine_pending',label:'Four dilution-aware valuation scenarios with sensitivity',status:'missing',detail:'ATLAS scenario engine not built: must model five-year revenue, margins, capex, debt, new financing, share dilution, exit values and downside before forecasting per-share returns'},
  {key:'mispricing',progress:'engine_pending',label:'Testable market mispricing thesis and counterevidence',status:'missing',detail:'ATLAS mispricing analysis not connected: compare today\'s dated share price and valuation with explicit, falsifiable future business assumptions and counterevidence'},
  {key:'durability',progress:'engine_pending',label:'Cited competitive durability and obsolescence research',status:'missing',detail:'ATLAS competitive-research integration not connected: source product/industry filings, customer exposure, switching costs, substitution threats and AI-infrastructure beneficiaries'},
  {key:'ownership',progress:'engine_pending',label:'Institutional/VC ownership with reporting dates',status:'missing',detail:'Institutional 13F/consensus dashboards exist, but ATLAS has not yet resolved this issuer\'s CUSIP, manager affiliations, reporting delays and independent active holdings within the Conviction Lab'},
  {key:'monitoring',progress:'partially_sourced',label:'Versioned thesis and explicit invalidation triggers',status:'missing',detail:'Timestamped manual thesis drafts work now; automatic filing/price monitoring, evidence-triggered invalidation, version comparisons and alerts are not connected'}
 ];
 return {
  fundingRisk,
  verdict:'INSUFFICIENT EVIDENCE',
  summary:'A fundamental candidate is not yet a defensible investment recommendation. Price-sensitive, source-backed return scenarios and the risk evidence remain incomplete.',
  verifiedCount:requirements.filter(x=>x.status==='verified').length,
  totalCount:requirements.length,
  observed:{revenueGrowthPct:current?metrics?.growth??null:null,freeCashFlow:current?metrics?.fcf??null:null,fcfMarginPct:current?metrics?.fcfMargin??null:null,netMarginPct:current?metrics?.profitMargin??null:null,fyPe:pe?.pe??null,asOfDate:recentClose?price!.sessionDate:null,fiscalYear:current?metrics?.year??null:null},
  requirements
 };
}
