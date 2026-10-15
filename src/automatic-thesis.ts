// Deterministic research draft: narrative evidence only, not a forecast,
// fair-value estimate, institutional consensus conclusion or live alert.
import type {ConvictionAssessment} from './conviction-readiness';
import type {SecCompany,MarketValuationClose} from './ranking-model';
import {deriveFinancingAutomation} from './financing-automation';
const format=(n:number|null)=>n===null?'unavailable':n.toFixed(1)+'%';
const amount=(n:number|null)=>n===null?'unavailable':'$'+n.toLocaleString('en-US',{maximumFractionDigits:0});
export type AutomatedThesisDraft={thesis:string;invalidation:string;source:string;asOf:string;note:string};
export function draftIssuerThesis(company:SecCompany,assessment:ConvictionAssessment,quote:MarketValuationClose|null,asOf:string):AutomatedThesisDraft{
 const finance=deriveFinancingAutomation(company,asOf);
 const obs=assessment.observed;
 const fcf=obs.freeCashFlow;
 const valuation=obs.fyPe===null?'An indicative FY earnings multiple is not established.':'Indicative FY earnings multiple '+obs.fyPe.toFixed(1)+'x; not a forward valuation or a fair-value target.';
 const bullets=[
  company.ticker+' · '+company.name+' — automatically assembled research hypothesis, as of '+asOf+'.',
  'SEC fiscal '+(obs.fiscalYear??'unknown')+' revenue growth: '+format(obs.revenueGrowthPct)+'; FCF margin: '+format(obs.fcfMarginPct)+'; after-capex FCF: '+amount(fcf)+'.',
  'Recent documented stock close: '+(quote&&quote.completedSession&&quote.ticker===company.ticker?'$'+quote.price.toFixed(2)+' on '+quote.sessionDate+' (Alpaca IEX)':'unavailable')+'. '+valuation,
  'Latest filed cash: '+(finance.cash?amount(finance.cash.value)+' (period '+finance.cash.end+', filed '+finance.cash.filed+')':'not established')+'; debt observations: '+finance.debtFields+'/3 sample components. Missing is NOT zero.',
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
  '6. Recheck price and SEC filing dates, the original SEC filing and both favorable and unfavorable evidence before any investment conclusion.'
 ];
 return {thesis:bullets.join('\n'),invalidation:invalidation.join('\n'),source:company.source,asOf,
  note:'Generated from the currently loaded SEC/market evidence; not a verified investment thesis, forecast, fair value, monitoring system or recommendation.'};
}
