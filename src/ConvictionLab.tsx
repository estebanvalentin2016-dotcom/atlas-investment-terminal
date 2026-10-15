import {useState,type FormEvent} from 'react';
import {assessConvictionReadiness,type ConvictionAssessment} from './conviction-readiness';
import SurvivalEvidencePanel from './SurvivalEvidencePanel';
import type {MarketValuationClose,SecCompany} from './ranking-model';
type ThesisVersion={ticker:string;createdAt:string;thesis:string;invalidation:string;verdict:'INSUFFICIENT EVIDENCE'};
const KEY='atlas.conviction.theses.v1';
const currency=(value:number|null)=>value===null?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(value);
const pct=(value:number|null)=>value===null?'N/A':(value>0?'+':'')+value.toFixed(1)+'%';
function nyToday(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const x=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return x.year+'-'+x.month+'-'+x.day;
}
const readVersions=():ThesisVersion[]=>{try{const value=localStorage.getItem(KEY);const list=value?JSON.parse(value):[];return Array.isArray(list)?list.filter(x=>x&&typeof x.ticker==='string'&&typeof x.thesis==='string').slice(-100):[]}catch{return []}};
export default function ConvictionLab({initialTicker='BLK'}:{initialTicker?:string}){
 const [ticker,setTicker]=useState(initialTicker);
 const [company,setCompany]=useState<SecCompany|null>(null);
 const [assessment,setAssessment]=useState<ConvictionAssessment|null>(null);
 const [marketIssue,setMarketIssue]=useState('');
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [thesis,setThesis]=useState('');
 const [invalidation,setInvalidation]=useState('');
 const [history,setHistory]=useState<ThesisVersion[]>(readVersions);
 const [savedMessage,setSavedMessage]=useState('');
 async function investigate(e:FormEvent){
  e.preventDefault();
  const symbol=ticker.trim().toUpperCase();
  setError('');setMarketIssue('');setCompany(null);setAssessment(null);setSavedMessage('');
  if(!/^[A-Z0-9.-]{1,12}$/.test(symbol)){setError('Enter a valid stock ticker.');return}
  setLoading(true);
  try{
   const r=await fetch('/api/sec/company?ticker='+encodeURIComponent(symbol));
   const sec=await r.json() as SecCompany&{error?:string};
   if(!r.ok||!Array.isArray(sec.metrics)||!sec.source?.startsWith('https://data.sec.gov/'))throw Error(sec.error||'Verified SEC financial facts unavailable');
   let market:MarketValuationClose|null=null;
   try{
    const response=await fetch('/api/market/valuation-close?ticker='+encodeURIComponent(symbol));
    const body=await response.json() as MarketValuationClose&{error?:string};
    if(!response.ok)throw Error(body.error||'IEX close unavailable');
    market=body;
   }catch(e){setMarketIssue(e instanceof Error?e.message:'IEX close unavailable')}
   setCompany(sec);
   setAssessment(assessConvictionReadiness(sec,market,nyToday()));
  }catch(e){setError(e instanceof Error?e.message:'Research source unavailable')}
  finally{setLoading(false)}
 }
 function saveThesis(){
  if(!company||!thesis.trim()||!invalidation.trim())return;
  const version:ThesisVersion={ticker:company.ticker,createdAt:new Date().toISOString(),thesis:thesis.trim(),invalidation:invalidation.trim(),verdict:'INSUFFICIENT EVIDENCE'};
  const next=[...readVersions(),version].slice(-100);
  try{localStorage.setItem(KEY,JSON.stringify(next));setHistory(next);setSavedMessage('Saved a timestamped local thesis draft. It is not monitored or verified automatically.')}
  catch{setSavedMessage('Browser storage unavailable. Thesis was not saved.')}
 }
 const existing=company?history.filter(x=>x.ticker===company.ticker).slice(-4).reverse():[];
 return <section className="panel real-panel atlas-conviction-lab">
  <div className="panel-head"><div><span className="eyebrow">ATLAS / INVESTMENT CONVICTION</span><h3>Can we defend an investment thesis?</h3></div><span className="tag">Evidence first · No fabricated ratings</span></div>
  <p className="description"><strong>Investigate a company, see the evidence and identify what's missing.</strong> This is the first bridge from the existing SEC research to your planned 3–7-year conviction engine.</p>
  <form className="atlas-ranking-controls" onSubmit={investigate}>
   <label>Company ticker<input aria-label="Conviction research ticker" value={ticker} onChange={e=>setTicker(e.target.value)} maxLength={12} required placeholder="BLK"/></label>
   <button className="button primary" type="submit" disabled={loading}>{loading?'Checking real sources…':'Examine investment evidence'}</button>
  </form>
  {error&&<p className="real-error" role="alert">{error}</p>}
  {marketIssue&&<p className="opportunity-uncertainty"><strong>Market-price source limitation:</strong> {marketIssue}</p>}
  {!assessment&&<div className="atlas-conviction-intro"><strong>Five verdicts, one evidence standard.</strong><p>Strong Speculative Buy · Buy Candidate · Watchlist · Avoid · Insufficient Evidence</p><p>For now, the engine can only issue <strong>Insufficient Evidence</strong> because the full valuation, risk and mispricing modules are not built. It does not assign arbitrary return probabilities.</p></div>}
  {assessment&&company&&<div className="atlas-conviction-result">
   <div className="atlas-conviction-verdict"><span>{company.ticker} · {company.name}</span><strong>{assessment.verdict}</strong><p>{assessment.summary}</p></div>
   <div className="atlas-conviction-count"><strong>{assessment.verifiedCount}/{assessment.totalCount}</strong><span>Evidence gates currently supported</span></div>
   <div className="atlas-key-return">
    <div><span className="atlas-glance-label">SEC revenue growth</span><strong className="atlas-glance-value">{pct(assessment.observed.revenueGrowthPct)}</strong><small>FY {assessment.observed.fiscalYear??'unknown'}</small></div>
    <div><span className="atlas-glance-label">Free cash flow after capex</span><strong className="atlas-glance-value">{currency(assessment.observed.freeCashFlow)}</strong><small>Company SEC fiscal period</small></div>
    <div><span className="atlas-glance-label">FCF margin</span><strong className="atlas-glance-value">{pct(assessment.observed.fcfMarginPct)}</strong><small>Reported operating cash flow less capex ÷ sales</small></div>
    <div><span className="atlas-glance-label">Indicative annual P/E</span><strong className="atlas-glance-value">{assessment.observed.fyPe===null?'N/A':assessment.observed.fyPe.toFixed(1)+'×'}</strong><small>{assessment.observed.asOfDate??'Quote missing'} · not TTM or forward</small></div>
   </div>
   <SurvivalEvidencePanel company={company} asOf={assessment.observed.asOfDate??nyToday()}/>
   <p className="chart-note"><strong>Source:</strong> <a href={company.source} target="_blank" rel="noopener noreferrer">SEC company financial facts ↗</a>. Missing or delayed figures remain unknown. An attractive reported metric is not evidence of mispricing.</p>
   <details className="atlas-details" open><summary>What must be established before a buy verdict?</summary>
    <div className="atlas-conviction-gates">{assessment.requirements.map(item=><div key={item.key}><strong>{item.status==='verified'?'✓':'○'} {item.label}</strong><p>{item.detail}</p></div>)}</div>
   </details>
   <div className="atlas-conviction-thesis">
    <strong>Write your own testable investment thesis</strong>
    <label>What might the market be missing?<textarea rows={3} value={thesis} onChange={e=>setThesis(e.target.value)} placeholder="A documented business change, valuation disconnect, or credible growth catalyst…"/></label>
    <label>What would prove you wrong?<textarea rows={3} value={invalidation} onChange={e=>setInvalidation(e.target.value)} placeholder="Financial thresholds, dilution, loss of a major customer or failed commercialization…"/></label>
    <button className="button secondary" type="button" disabled={!thesis.trim()||!invalidation.trim()} onClick={saveThesis}>Save timestamped thesis draft</button>
    {savedMessage&&<p role="status">{savedMessage}</p>}
    {existing.length>0&&<details className="atlas-details"><summary>Previous saved thesis drafts ({existing.length} recent)</summary>{existing.map(item=><div className="atlas-thesis-history" key={item.createdAt}><strong>{new Date(item.createdAt).toLocaleString('en-US')}</strong><p>{item.thesis}</p><p><strong>Invalidation:</strong> {item.invalidation}</p></div>)}</details>}
   </div>
  </div>}
 </section>;
}
