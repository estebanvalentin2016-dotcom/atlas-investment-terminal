import {deriveFinancingAutomation,type FinancingFact} from './financing-automation';
import type {SecCompany} from './ranking-model';
const money=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
function Audit({label,fact}:{label:string;fact:FinancingFact|null}){
 return <p><strong>{label}:</strong> {money(fact?.value??null)} · period {fact?.end??'unknown'} · filed {fact?.filed??'unknown'} · accession {fact?.accession??'unknown'} · GAAP tag {fact?.tag??'unknown'}</p>;
}
export default function FinancingAutomationPanel({company,asOf}:{company:SecCompany;asOf:string}){
 const a=deriveFinancingAutomation(company,asOf);
 return <section className="atlas-survival-panel" aria-label="Automated SEC liquidity and financing assessment">
  <div className="atlas-survival-panel-head"><strong>Automatic cash runway & financing research</strong><span>10-Q / 10-K evidence · incomplete, no credit verdict</span></div>
  <div className="atlas-survival-metrics">
   <div><span>Latest filed cash</span><strong>{money(a.cash?.value??null)}</strong><small>SEC period {a.cash?.end??'unknown'} · {a.status==='recent_partial'?'Recent observation':'Not verified current'}</small></div>
   <div><span>Same-period working capital</span><strong className={a.workingCapital!==null&&a.workingCapital<0?'atlas-tone-negative':''}>{money(a.workingCapital)}</strong><small>Current assets less liabilities · current ratio {a.currentRatio??'unknown'}</small></div>
   <div><span>Debt components reported</span><strong>{a.debtFields}/3</strong><small>{a.reportedDebtSubtotal===null?'Total and maturity schedule unknown':'Observed subset '+money(a.reportedDebtSubtotal)+'; not total debt'}</small></div>
   <div><span>Historical cash / annual FCF burn</span><strong>{a.cashToHistoricalBurnYears===null?'Unknown':a.cashToHistoricalBurnYears.toFixed(2)+' years'}</strong><small>Mechanical stress ratio only; NOT forecast runway</small></div>
  </div>
  {a.shareCountWarning&&<p className="atlas-survival-warning" role="alert"><strong>Share-count reconciliation required:</strong> {a.shareCountWarning}</p>}
  {a.status==='historical_only'&&<p className="opportunity-uncertainty"><strong>Stale liquidity:</strong> ATLAS found historical cash but not a recent source-dated balance-sheet period.</p>}
  {a.status==='unavailable'&&<p className="opportunity-uncertainty"><strong>Liquidity source incomplete:</strong> A current cash snapshot and reliable cash runway cannot be established from supported SEC facts.</p>}
  <details className="atlas-details"><summary>Audit automatically collected filings, financing gaps and assumptions</summary>
   <p><strong>Information as of:</strong> {asOf}. All items are automatically read from issuer SEC facts, not manually entered.</p>
   <Audit label="Cash and equivalents" fact={a.cash}/>
   <Audit label="Current assets" fact={a.currentAssets}/>
   <Audit label="Current liabilities" fact={a.currentLiabilities}/>
   <Audit label="Current portion of long-term debt" fact={a.currentDebt}/>
   <Audit label="Noncurrent long-term debt" fact={a.noncurrentDebt}/>
   <Audit label="Short-term borrowings" fact={a.shortBorrowings}/>
   <p><strong>Latest supported FY free cash flow:</strong> {money(a.annualFcf)}. Operating cash flow less capex, not forecast free cash flow.</p>
   {a.notes.map((note,i)=><p key={i}>{note}</p>)}
   <p><a href={a.source} target="_blank" rel="noopener noreferrer">Inspect issuer SEC companyfacts ↗</a></p>
  </details>
 </section>;
}
