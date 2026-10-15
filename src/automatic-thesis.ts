// Deterministic research draft: narrative evidence only, not a forecast,
// fair-value estimate, institutional consensus conclusion or live alert.
import type {ConvictionAssessment} from './conviction-readiness';
import type {SecCompany,MarketValuationClose} from './ranking-model';
import {deriveFinancingAutomation} from './financing-automation';
import type {PriceHistoryAssessment} from './price-history-model';
const format=(n:number|null)=>n===null?'unavailable':n.toFixed(1)+'%';
const amount=(n:number|null)=>n===null?'unavailable':'$'+n.toLocaleString('en-US',{maximumFractionDigits:0});
export type AutomatedThesisDraft={thesis:string;invalidation:string;source:string;asOf:string;note:string};
export function draftIssuerThesis(company:SecCompany,assessment:ConvictionAssessment,quote:MarketValuationClose|null,asOf:string,history:PriceHistoryAssessment|null=null):AutomatedThesisDraft{
 const finance=deriveFinancingAutomation(company,asOf);
 const obs=assessment.observed;
 const fcf=obs.freeCashFlow;
 const valuation=obs.fyPe===null?'An indicative FY earnings multiple is not established.':'Indicative FY earnings multiple '+obs.fyPe.toFixed(1)+'x; not a forward valuation or a fair-value target.';
 const validQuote=quote&&quote.completedSession&&quote.ticker===company.ticker&&assessment.observed.asOfDate===quote.sessionDate;
 const useHistory=history?.status==='usable';
 const oneYear=useHistory?history.returns.year1:null;
 const threeYear=useHistory?history.returns.year3:null;
 const fiveYear=useHistory?history.returns.year5:null;
 const priceLabel=(v:number|null)=>v===null?'unavailable':(v>0?'+':'')+v.toFixed(1)+'%';
 const historyLine=useHistory?'Observed split-adjusted IEX weekly stock-price change (dividends excluded, latest completed week '+history.latestDate+'): 1Y '+priceLabel(oneYear)+'; 3Y '+priceLabel(threeYear)+'; 5Y '+priceLabel(fiveYear)+'. Not verified IPO-to-date or total shareholder return.':'Comparable long-term split-adjusted stock-price history is unavailable; historical performance cannot be inferred.';
 const fyEnd=company.metrics.find(m=>m.name==='Revenue')?.values.find(v=>v.year===obs.fiscalYear)?.end??'unknown';
 const recentStockWindow=history?.returnStartDates.year1&&history.latestDate?history.returnStartDates.year1+' to '+history.latestDate:'unavailable';
 const divergence=oneYear!==null&&obs.revenueGrowthPct!==null&&obs.revenueGrowthPct>0&&oneYear<0?
  'CROSS-PERIOD CONTRAST TO INVESTIGATE: SEC FY '+(obs.fiscalYear??'unknown')+' revenue increased '+format(obs.revenueGrowthPct)+' (fiscal year ended '+fyEnd+'), whereas the stock price declined '+priceLabel(oneYear)+' during a DIFFERENT trailing one-year price window ('+recentStockWindow+'). These periods are not aligned: this does NOT establish same-period underperformance, a causal disconnect or undervaluation. Investigate price expectations, earnings, dilution and business risks.':
  oneYear!==null&&threeYear!==null&&oneYear>0&&threeYear>0?
  'One- and three-year observed stock prices both increased. Momentum is not proof of undervaluation or future gains.':
  'Stock-price trend alone does not determine intrinsic value or a fair purchase price.';
 const bullets=[
  company.ticker+' · '+company.name+' — automatically assembled research hypothesis, as of '+asOf+'.',
  'SEC fiscal '+(obs.fiscalYear??'unknown')+' revenue growth: '+format(obs.revenueGrowthPct)+'; FCF margin: '+format(obs.fcfMarginPct)+'; after-capex FCF: '+amount(fcf)+'.',
  'Recent documented stock close: '+(validQuote?'$'+quote!.price.toFixed(2)+' on '+quote!.sessionDate+' (Alpaca IEX)':'unavailable')+'. '+valuation,
  'SHAREHOLDER PRICE HISTORY\n'+historyLine+'\n'+divergence,
  'FINANCING\nLatest filed cash: '+(finance.cash?amount(finance.cash.value)+' (period '+finance.cash.end+', filed '+finance.cash.filed+')':'not established')+'; debt observations: '+finance.debtFields+'/3 sample components. Missing is NOT zero.',
  finance.shareCountWarning?'Capital-structure warning: weighted share count conflicts materially with DEI reported common shares; per-share conclusions require reconciliation.':'Capital-structure completeness, future issuance and full funding capacity are not established.',
  'WORKING HYPOTHESIS ONLY: investigate whether the reported operating trends are sustainable and whether the current stock price already discounts them. No source-backed fair value, upside estimate or market mispricing conclusion has been demonstrated.',
  'SEC primary source: '+company.source
 ];
 const invalidation=[
  'Automatic review checklist (NOT active alerts; not observed trigger events):',
  '1. Compare the next publicly filed annual or quarterly revenue disclosures with the current growth baseline ('+format(obs.revenueGrowthPct)+'); investigate a sustained deterioration or accounting-tag change.',
  '2. Compare the next annual operating cash flow and capex with FY after-capex FCF ('+amount(fcf)+'); distinguish expansion spending from operating funding shortfalls.',
  '3. Reconcile current cash, credit facilities, debt maturity dates, convertible instruments and any equity issuance before assuming the business can self-fund.',
  '4. Reconcile all share classes, splits and diluted shares; reassess per-share economics when share count or capital structure changes.',
  '5. Reassess competitive threats, concentration, product obsolescence, disclosed risks and current expectations against genuine source-backed valuation scenarios.',
  '6. Recheck source-dated split-adjusted 1Y/3Y stock-price performance ('+priceLabel(oneYear)+' / '+priceLabel(threeYear)+'); determine if share-price weakness is justified by fundamentals and valuation rather than assuming it represents a bargain.',
  '7. Recheck price and SEC filing dates, the original SEC filing and both favorable and unfavorable evidence before any investment conclusion.'
 ];
 return {thesis:bullets.join('\n\n'),invalidation:invalidation.join('\n\n'),source:company.source,asOf,
  note:'Generated from the currently loaded SEC/market evidence; not a verified investment thesis, forecast, fair value, monitoring system or recommendation.'};
}
