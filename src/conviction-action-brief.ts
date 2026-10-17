// One-page decision synthesis. Evaluating a gate is NOT verifying every
// underlying source. Unknown facts stay unknown; no buy rating is fabricated.
import type {ConvictionAssessment} from './conviction-readiness';
import type {SecCompany} from './ranking-model';
import {assessSectorRisk} from './sector-risk-brief';

export type ConvictionActionBrief={
 action:'WATCH'|'INVESTIGATE'|'DEPRIORITIZE';
 headline:string;finding:string;implication:string;nextEvidence:string;
 processedChecks:number;sourceVerified:number;unclearedChecks:number;
 evidenceVerdict:'INSUFFICIENT EVIDENCE';
 sector:'bank'|'general';
};
const fmt=(n:number|null)=>n===null?'unavailable':(n>=0?'+':'')+n.toFixed(1)+'%';
export function createConvictionActionBrief(company:SecCompany,assessment:ConvictionAssessment,asOf:string):ConvictionActionBrief{
 const s=assessSectorRisk(company,asOf);
 const o=assessment.observed;
 const processedChecks=assessment.requirements.length;
 const sourceVerified=assessment.requirements.filter(x=>x.status==='verified').length;
 const basic={processedChecks,sourceVerified,unclearedChecks:processedChecks-sourceVerified,
  evidenceVerdict:assessment.verdict,sector:s.sector};
 const annual='SEC FY '+(o.fiscalYear??'unknown')+' revenue change '+fmt(o.revenueGrowthPct)+
  '; indicative dated annual P/E '+(o.fyPe===null?'unavailable':o.fyPe.toFixed(1)+'×')+'.';
 if(s.sector==='bank')return {...basic,action:'WATCH',headline:'Bank capital and credit quality not yet established',
  finding:annual+' '+(s.equityAssetsPct===null?'No same-period book equity/assets ratio established.':'Same-period book equity/assets '+s.equityAssetsPct.toFixed(1)+'% (not CET1).'),
  implication:'A bank cannot be judged from a generic cash-runway ratio, a historical FCF margin, or compounded revenue/FCF projections. Strong accounting growth could be affected by acquisitions or share changes.',
  nextEvidence:'ATLAS must reconcile regulatory CET1, deposits, loan quality, credit-loss provisions, share-count changes and bank-specific price/book or earnings valuation. No bullish purchase case yet.'};
 if(assessment.fundingRisk.status==='growth_with_negative_fcf'||assessment.fundingRisk.status==='negative_fcf')return {...basic,action:'WATCH',headline:'Cash generation is a financing question',
  finding:annual+' Reported annual after-capex cash flow was negative.',
  implication:'Business growth alone is not evidence that expansion is self-funded. Funding needs, upcoming maturities and dilution can change per-share outcomes.',
  nextEvidence:'ATLAS must reconcile current financing, cash burn, debt maturities, dilution and an issuer-specific downside case before promoting this stock.'};
 if(o.revenueGrowthPct!==null&&o.revenueGrowthPct>10&&o.fcfMarginPct!==null&&o.fcfMarginPct>0&&o.fyPe!==null&&o.fyPe>0&&o.fyPe<40)return {...basic,action:'INVESTIGATE',headline:'Financial strength merits research; upside unproven',
  finding:annual+' SEC annual after-capex FCF margin '+fmt(o.fcfMarginPct)+'.',
  implication:'Several historical fundamentals are favorable, but they do not establish an attractive entry price, durability or forward shareholder returns.',
  nextEvidence:'ATLAS must resolve financing/share classes and calculate source-backed downside, base and upside per-share valuation before a bullish recommendation.'};
 return {...basic,action:'WATCH',headline:'Insufficient evidence for a bullish investment',
  finding:annual+' '+(o.freeCashFlow===null?'Comparable annual cash generation is unavailable.':'SEC annual cash generation is recorded but not a valuation.'),
  implication:'The existing evidence does not justify treating this stock as a proven mispricing opportunity.',
  nextEvidence:'ATLAS must reconcile forward earnings, capital structure, competitive threats and price-sensitive per-share valuation. Any unavailable source remains explicitly unverified.'};
}
