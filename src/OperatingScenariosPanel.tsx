import {deriveOperatingScenarios} from './operating-scenarios';
import type {SecCompany} from './ranking-model';
const usd=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
const pct=(n:number|null)=>n===null?'Unknown':(n>0?'+':'')+n.toFixed(1)+'%';
export default function OperatingScenariosPanel({company,asOf}:{company:SecCompany;asOf:string}){
 const e=deriveOperatingScenarios(company,asOf);
 return <section className="atlas-survival-panel" aria-label="Five-year SEC anchored operating sensitivities">
  <div className="atlas-survival-panel-head"><strong>Five-year operating sensitivities</strong><span>Automatically generated · NOT share-price forecasts</span></div>
  {e.status==='partial'?<>
   <p className="chart-note"><strong>SEC starting point:</strong> FY ended {e.fiscalEnd}, filed {e.filed}. Revenue {usd(e.initialRevenue)}; observed prior-year revenue growth {pct(e.observedRevenueGrowthPct)}; historical FCF margin {pct(e.observedFcfMarginPct)}.</p>
   <div style={{overflowX:'auto'}}>
    <table className="atlas-scenario-table">
     <thead><tr><th scope="col">Illustrative case</th><th scope="col">Annual revenue growth</th><th scope="col">Year-5 FCF margin</th><th scope="col">Year-5 revenue</th><th scope="col">Year-5 annual FCF</th></tr></thead>
     <tbody>{e.rows.map(row=><tr key={row.name}><th scope="row">{row.name}</th><td>{pct(row.annualRevenueGrowthPct)}</td><td>{pct(row.fy5FcfMarginPct)}</td><td>{usd(row.fy5Revenue)}</td><td><span className={row.fy5Fcf<0?'atlas-tone-negative':''}>{usd(row.fy5Fcf)}</span></td></tr>)}</tbody>
    </table>
   </div>
   <p className="chart-note"><strong>No five-year stock price or return is calculated.</strong> These cases are automatically constructed sensitivities, not probabilities, return predictions, a DCF, or evidence of market mispricing.</p>
  </>:<p className="opportunity-uncertainty"><strong>Scenario inputs blocked:</strong> {e.reasons.join(' ')||'Comparable SEC starting inputs unavailable.'}</p>}
  <details className="atlas-details"><summary>Examine scenario preset assumptions and valuation blockers</summary>
   <p>{e.caution}</p>
   <p><strong>Mechanical presets:</strong> bear = historical growth minus 20 percentage points, historical FCF margin minus 8 points; base sensitivity = half historical growth, same FCF margin; bull = historical growth, margin plus 4 points; remote moonshot = historical growth plus 10 points, margin plus 8 points. Bounds limit extreme growth and margin extrapolation; none of these changes is issuer guidance.</p>
   <p><strong>Calculation:</strong> future revenue = initial annual revenue × (1 + case growth)^year; annual future FCF = forecast sensitivity revenue × illustrative case margin. Not actual cash distributions or enterprise/equity values.</p>
   <p><strong>Before per-share valuation:</strong> reconcile the latest actual share count and share classes, split history, company net cash/debt/leases/convertibles, financing/issuance, discount rates, terminal valuation, dilution and industry valuation assumptions. Missing data cannot be treated as zero.</p>
   <p><a href={e.source} target="_blank" rel="noopener noreferrer">Inspect original issuer SEC companyfacts ↗</a></p>
  </details>
 </section>;
}
