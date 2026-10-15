import {deriveSurvivalEvidence,type SourcedFigure} from './survival-evidence';
import {deriveFinancingAutomation} from './financing-automation';
import type {SecCompany} from './ranking-model';
const usd=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
const nums=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);
const sign=(n:number|null)=>n===null?'Unknown':(n>=0?'+':'')+n.toFixed(2)+'%';
function FactLine({label,source}:{label:string;source:SourcedFigure|null}){
 return <p><strong>{label}:</strong> {usd(source?.value??null)} · fiscal end {source?.fiscalEnd??'unknown'} · filed {source?.filed??'unknown'} · SEC field {source?.tag??'unknown'}</p>;
}
export default function SurvivalEvidencePanel({company,asOf}:{company:SecCompany;asOf:string}){
 const evidence=deriveSurvivalEvidence(company,asOf);
 const quality=deriveFinancingAutomation(company,asOf);
 const debtReported=[evidence.currentDebt,evidence.noncurrentDebt,evidence.shortBorrowings].filter((x):x is SourcedFigure=>x!==null).length;
 return <section className="atlas-survival-panel" aria-label="SEC survivability and share count evidence">
  <div className="atlas-survival-panel-head"><strong>Capital & dilution evidence</strong><span>SEC annual data · not a survival verdict</span></div>
  <div className="atlas-survival-metrics">
   <div><span>Cash & equivalents</span><strong>{usd(evidence.cash?.value??null)}</strong><small>{evidence.cash?.filed?'Filed '+evidence.cash.filed:'Not verified for same FY'}</small></div>
   <div><span>Debt categories available</span><strong>{debtReported}/3</strong><small>Completeness NOT established</small></div>
   <div><span>Weighted-average diluted shares</span><strong>{quality.shareCountWarning?'Unreconciled':nums(evidence.weightedDilutedShares?.value??null)}</strong><small>{quality.shareCountWarning?'SEC share unit/class inconsistency; view automated funding audit':'Not current shares outstanding'}</small></div>
   <div><span>YoY weighted-share change</span><strong>{quality.shareCountWarning?'Unknown':sign(evidence.weightedShareChangePct)}</strong><small>{quality.shareCountWarning?'Dilution proxy blocked until shares reconciled':'Potential dilution proxy; not verified issuance'}</small></div>
  </div>
  {evidence.freeCashFlow!==null&&evidence.freeCashFlow<0&&<p className="atlas-survival-warning"><strong>Negative FY free cash flow:</strong> {usd(evidence.freeCashFlow)}. {evidence.simpleCashToBurnYears===null?'No comparable cash/FCF coverage.':'Cash ÷ annual negative FCF = '+evidence.simpleCashToBurnYears+' years (mechanical ratio, NOT forecast runway).'}</p>}
  <details className="atlas-details"><summary>Verify SEC cash, debt, share history and remaining risks</summary>
   <p><strong>Fiscal year:</strong> {evidence.fiscalYear??'Unknown'} · <strong>period end:</strong> {evidence.fiscalEnd??'Unknown'} · <strong>information as of:</strong> {asOf}.</p>
   <FactLine label="Cash and equivalents" source={evidence.cash}/>
   <FactLine label="Current portion of long-term debt" source={evidence.currentDebt}/>
   <FactLine label="Long-term debt noncurrent" source={evidence.noncurrentDebt}/>
   <FactLine label="Short-term borrowings" source={evidence.shortBorrowings}/>
   <p><strong>FY weighted-average diluted shares:</strong> {nums(evidence.weightedDilutedShares?.value??null)} · <strong>FY comparison:</strong> {nums(evidence.previousWeightedDilutedShares?.value??null)}.</p>
   {quality.shareCountWarning&&<p className="atlas-survival-warning"><strong>Unreconciled raw SEC share values:</strong> {quality.shareCountWarning}</p>}
   {evidence.missing.length>0&&<p><strong>Missing evidence:</strong> {evidence.missing.join('; ')}.</p>}
   {evidence.notes.map((n,i)=><p key={i}>{n}</p>)}
   <p><a href={evidence.source} rel="noopener noreferrer" target="_blank">Original SEC company financial facts ↗</a></p>
  </details>
 </section>;
}
