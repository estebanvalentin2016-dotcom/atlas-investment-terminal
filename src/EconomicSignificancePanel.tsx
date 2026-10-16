import type {SecCompany} from './ranking-model';
import type {FilingEvidenceResult} from './FilingEvidence';
import {assessEconomicSignificance} from './economic-significance';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
const pct=(n:number)=>(n>0?'+':'')+n.toFixed(1)+'%';
export default function EconomicSignificancePanel({ticker,filingUrl,asOf,review,company}:{
 ticker:string;filingUrl:string;asOf:string;review:FilingEvidenceResult|null;company:SecCompany|null;
}){
 const a=assessEconomicSignificance({ticker,filingUrl,asOf,review,company});
 const summary=a.status==='quantified_improvement'?'Reported operating improvement · impact still unproven':
  a.status==='adverse_or_mixed'?'Adverse or mixed economic signals':
  a.status==='descriptive_only'?'Reported figures · direction or impact unverified':
  a.status==='unquantified'?'Economic magnitude not quantified':'Insufficient SEC source evidence';
 return <section className="atlas-economic-impact" aria-label={'Economic significance assessment for '+ticker}>
  <div className="atlas-economic-head">
   <div><span className="eyebrow">ATLAS / ECONOMIC SIGNIFICANCE</span><strong>Does the catalyst actually change the business?</strong></div>
   <span className="tag">Not a valuation verdict</span>
  </div>
  <p><strong>{summary}</strong></p>
  <p className="chart-note">{a.explanation}</p>
  {a.signals.length>0?<div className="atlas-economic-evidence">
   {a.signals.slice(0,5).map((signal,i)=><div key={signal.category+'-'+i}>
    <span>{signal.label}</span>
    <strong className={signal.direction==='deterioration'?'atlas-tone-negative':signal.direction==='improvement'?'atlas-tone-positive':''}>
     {signal.changePct===null?signal.reportedValue:pct(signal.changePct)}
    </strong>
    <small>{signal.direction==='descriptive'?'SEC-reported quantity; incremental profitability unknown':signal.direction==='deterioration'?'Reported adverse business movement':'Company-reported change; baseline and persistence unverified'}</small>
    <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect SEC passage ↗</a>
   </div>)}
  </div>:<p className="chart-note"><strong>No verified magnitude extracted.</strong> An earnings-related 8-K or positive news headline is not, by itself, a quantified improvement.</p>}
  {a.annual&&<p className="chart-note"><strong>Separate annual reference:</strong> FY {a.annual.fiscalYear} SEC revenue {money(a.annual.revenue)}{a.annual.reportedGrowthPct!==null?' · annual revenue growth '+pct(a.annual.reportedGrowthPct):''}{a.annual.fcfMarginPct!==null?' · annual FCF margin '+pct(a.annual.fcfMarginPct):''}. Filed {a.annual.filed}. These figures may describe a different period from this 8-K.</p>}
  {a.sensitivity&&<div className="atlas-economic-sensitivity">
   <strong>Translate operating economics into dollars</strong>
   <p className="chart-note">At the reported annual revenue scale, a hypothetical 1- or 3-percentage-point change in after-capex FCF margin changes annual FCF by the amounts below, assuming unchanged revenue.</p>
   <div><span>±1-point margin sensitivity</span><strong>±{money(a.sensitivity.onePointAnnualFcf)} / year</strong></div>
   <div><span>±3-point margin sensitivity</span><strong>±{money(a.sensitivity.threePointAnnualFcf)} / year</strong></div>
   <small><strong>Not a forecast:</strong> ATLAS has NOT established that this filing will change the margin by either amount. No equity valuation or per-share target is implied.</small>
  </div>}
  <details className="atlas-details">
   <summary>What still blocks a bullish economic conclusion? ({a.limitations.length})</summary>
   <p><strong>Surprise versus pre-release consensus:</strong> Unknown. <strong>Independent original-news verification:</strong> Pending. <strong>Verified regulatory/material economic significance:</strong> Not established. <strong>Change in discounted per-share fair value:</strong> Unknown.</p>
   {a.limitations.map((line,i)=><p key={i}>· {line}</p>)}
  </details>
 </section>;
}
