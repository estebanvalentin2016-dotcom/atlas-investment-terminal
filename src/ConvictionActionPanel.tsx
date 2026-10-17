import type {ConvictionAssessment} from './conviction-readiness';
import type {SecCompany} from './ranking-model';
import {createConvictionActionBrief} from './conviction-action-brief';
import {assessSectorRisk} from './sector-risk-brief';
const percent=(n:number|null)=>n===null?'Unverified':n.toFixed(1)+'%';
export default function ConvictionActionPanel({company,assessment,asOf}:{company:SecCompany;assessment:ConvictionAssessment;asOf:string}){
 const d=createConvictionActionBrief(company,assessment,asOf);
 const risk=assessSectorRisk(company,asOf);
 return <section className="atlas-conviction-decision" aria-label={'Automatic research decision for '+company.ticker}>
  <div className="atlas-conviction-decision-head">
   <div><span className="eyebrow">ATLAS / AUTOMATED DECISION BRIEF</span><h3>{d.headline}</h3></div>
   <span className="atlas-action-label atlas-action-watch">{d.action} · NOT A BUY SIGNAL</span>
  </div>
  <div className="atlas-conviction-decision-points">
   <div><strong>What ATLAS found</strong><p>{d.finding}</p></div>
   <div><strong>What it means</strong><p>{d.implication}</p></div>
   <div><strong>What changes this decision</strong><p>{d.nextEvidence}</p></div>
  </div>
  {risk.sector==='bank'&&<div className="atlas-conviction-sector-note">
   <strong>Bank-specific checks</strong>
   <div className="atlas-conviction-sector-facts">
    <span>Book equity / assets: <strong>{percent(risk.equityAssetsPct)}</strong></span>
    <span>Customer deposits / assets: <strong>{percent(risk.depositsAssetsPct)}</strong></span>
    <span>Loans / assets: <strong>{percent(risk.loansAssetsPct)}</strong></span>
   </div>
   <p><strong>Important:</strong> Book equity/assets is not the regulatory CET1 ratio, and missing bank balance-sheet fields are not zero. Historical FCF and cash-runway models are not bank solvency tests.</p>
   <details className="atlas-details"><summary>Bank source limitations ({risk.warnings.length})</summary>
    {risk.warnings.map((w,i)=><p key={i}>{w}</p>)}
    <p><a href={risk.source} target="_blank" rel="noopener noreferrer">Original dated SEC company facts ↗</a></p>
   </details>
  </div>}
  <p className="atlas-conviction-decision-coverage">
   <strong>{d.processedChecks}/{d.processedChecks} research questions evaluated.</strong> {d.sourceVerified} source-verified evidence categories; {d.unclearedChecks} categories remain unverified or analytically incomplete. A completed check means ATLAS assessed the available evidence, <strong>not</strong> that every necessary filing fact exists.
  </p>
 </section>;
}
