import {useState} from 'react';
import {assessConvictionReadiness,type ConvictionAssessment} from './conviction-readiness';
import type {MarketValuationClose,SecCompany} from './ranking-model';
type Check={ticker:string;issuer:string;cusip:string;className:string;priorReported:number;latestReported:number;delta:number;checked:boolean;percentChange:number;latestReportedValueDollars:number|null};
type Result={status:string;manager:string;checks:Check[];sources:{latest:{period:string;filed:string;informationTableUrl:string};previous:{period:string;filed:string;informationTableUrl:string};coverUrl:string};managerAffiliation:{reportType:string;otherIncludedManager:{cik:string;name:string}|null;verifiedFromCover:boolean};timing:string;interpretation:string;error?:string};
const num=(n:number)=>new Intl.NumberFormat('en-US').format(n);
const pct=(n:number|null)=>n===null?'N/A':(n>0?'+':'')+n.toFixed(2)+'%';
const money=(n:number|null)=>n===null?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
function todayNY(){const bits=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const d=Object.fromEntries(bits.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return d.year+'-'+d.month+'-'+d.day}
export default function InstitutionalHistoricalCase({onResearch}:{onResearch?:(ticker:string)=>void}={}){
 const [evidence,setEvidence]=useState<Result|null>(null),[error,setError]=useState('');
 const [waiting,setWaiting]=useState(false),[financialLoading,setFinancialLoading]=useState(false);
 const [fundamentals,setFundamentals]=useState<ConvictionAssessment|null>(null),[fundamentalIssue,setFundamentalIssue]=useState('');
 async function verify(){
  const refresh=Boolean(evidence);
  setWaiting(true);setEvidence(null);setError('');setFundamentals(null);setFundamentalIssue('');
  try{
   const response=await fetch('/api/institutions/historical-case'+(refresh?'?refresh=1':''));
   const data=await response.json() as Result;
   if(!response.ok||data.status!=='verified_against_live_sec')throw Error(data.error||'Source verification incomplete; no matched holding values may be claimed');
   setEvidence(data);
  }catch(e){setError(e instanceof Error?e.message:'SEC historical filings could not be verified')}
  finally{setWaiting(false)}
 }
 async function investigate(){
  if(!evidence)return;
  setFinancialLoading(true);setFundamentalIssue('');setFundamentals(null);
  try{
   const r=await fetch('/api/sec/company?ticker=RKT');
   const c=await r.json() as SecCompany&{error?:string};
   if(!r.ok||!Array.isArray(c.metrics)||c.ticker!=='RKT')throw Error(c.error||'RKT SEC company facts not verified');
   let quote:MarketValuationClose|null=null;
   try{
    const p=await fetch('/api/market/valuation-close?ticker=RKT');
    const v=await p.json() as MarketValuationClose;
    if(p.ok&&v.ticker==='RKT')quote=v;
   }catch{}
   setFundamentals(assessConvictionReadiness(c,quote,todayNY()));
  }catch(e){setFundamentalIssue(e instanceof Error?e.message:'SEC company financial facts unavailable')}
  finally{setFinancialLoading(false)}
 }
 return <section className="atlas-case-study">
  <div><span className="eyebrow">LIVE SEC HISTORICAL VALIDATION</span><h3>Can we verify a real manager's position change?</h3><p><strong>ValueAct Holdings · Rocket Companies (RKT).</strong> Q1 → Q2 2026. Unlike a mockup, the verification checks both original SEC information tables and the reporting-manager cover page.</p></div>
  <button type="button" className="button primary" disabled={waiting} onClick={()=>void verify()}>{waiting?'Reading original SEC documents…':evidence?'Verify source documents again':'Verify two real SEC reporting periods'}</button>
  {error&&<p className="opportunity-uncertainty" role="alert"><strong>Verification blocked:</strong> {error}. ATLAS will not substitute cached demo figures for the original SEC files.</p>}
  {evidence&&<div className="atlas-case-confirmation">
   <p className="atlas-summary-line"><strong>SEC evidence checked.</strong> Four securities' reported share counts matched the original Q1 and Q2 files. This confirms reporting differences, not transaction dates or investor motives.</p>
   <p className="chart-note"><strong>Before:</strong> {evidence.sources.previous.period} · published {evidence.sources.previous.filed} · <a href={evidence.sources.previous.informationTableUrl} target="_blank" rel="noopener noreferrer">SEC source ↗</a></p>
   <p className="chart-note"><strong>After:</strong> {evidence.sources.latest.period} · published {evidence.sources.latest.filed} · <a href={evidence.sources.latest.informationTableUrl} target="_blank" rel="noopener noreferrer">SEC source ↗</a></p>
   <div className="atlas-case-records">{evidence.checks.map(record=><article key={record.cusip}>
    <div><strong>{record.ticker} · {record.issuer}</strong><span>CUSIP {record.cusip} · {record.className}</span></div>
    <strong className={record.delta>=0?'atlas-tone-positive':'atlas-tone-negative'}>{record.delta>=0?'+':''}{num(record.delta)} shares</strong>
    <span>{num(record.priorReported)} → {num(record.latestReported)} · {pct(record.percentChange)}</span>
    <span>Latest reported position: {money(record.latestReportedValueDollars)}</span>
   </article>)}</div>
   <p className="opportunity-uncertainty"><strong>Affiliation check:</strong> This was a {evidence.managerAffiliation.reportType}. {evidence.managerAffiliation.otherIncludedManager?.name} (CIK {evidence.managerAffiliation.otherIncludedManager?.cik}) appears in the SEC cover page. <a href={evidence.sources.coverUrl} target="_blank" rel="noopener noreferrer">Inspect affiliation ↗</a> Do not count that included entity as an independent investor.</p>
   <p className="chart-note"><strong>Investor-stated thesis:</strong> not established. <strong>Independent active-manager convergence:</strong> not established. These share changes cannot alone support buying RKT.</p>
   <div className="atlas-ranking-controls"><button type="button" className="button secondary" disabled={financialLoading} onClick={()=>void investigate()}>{financialLoading?'Reading RKT SEC financials…':'Check RKT fundamentals and conviction readiness'}</button>{onResearch&&<button type="button" className="button secondary" onClick={()=>onResearch('RKT')}>Open RKT Company Research →</button>}</div>
   {fundamentalIssue&&<p className="opportunity-uncertainty">{fundamentalIssue}</p>}
   {fundamentals&&<div className="atlas-case-fundamentals">
    <strong>RKT investment readiness: {fundamentals.verdict}</strong>
    <div className="atlas-case-metrics"><div><span>SEC revenue growth</span><strong>{pct(fundamentals.observed.revenueGrowthPct)}</strong></div><div><span>Operating FCF after capex</span><strong>{money(fundamentals.observed.freeCashFlow)}</strong></div><div><span>Indicative FY P/E</span><strong>{fundamentals.observed.fyPe===null?'N/A':fundamentals.observed.fyPe.toFixed(1)+'×'}</strong></div></div>
    <p className="chart-note"><strong>{fundamentals.verifiedCount}/{fundamentals.totalCount} evidence gates supported.</strong> A fundamental metric cannot by itself show that today's stock valuation is attractive. Dilution, financing, business durability, expectations and mispricing need further validation.</p>
    <details className="atlas-details"><summary>What else must we verify?</summary>{fundamentals.requirements.filter(x=>x.status!=='verified').map(x=><p key={x.key}><strong>{x.label}:</strong> {x.detail}</p>)}</details>
   </div>}
  </div>}
 </section>;
}
