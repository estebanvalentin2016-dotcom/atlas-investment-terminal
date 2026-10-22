import {createConvictionActionBrief} from './conviction-action-brief';
import {saveResearchSummary} from './watchlist-research';
import {useState,type FormEvent} from 'react';
import {assessConvictionReadiness,type ConvictionAssessment} from './conviction-readiness';
import {PP_AND_E_FCF_DISCLOSURE} from './financial-methodology-eligibility';
import SurvivalEvidencePanel from './SurvivalEvidencePanel';
import MarketCapEvidencePanel from './MarketCapEvidencePanel';
import FinancingAutomationPanel from './FinancingAutomationPanel';
import OperatingScenariosPanel from './OperatingScenariosPanel';
import ConvictionActionPanel from './ConvictionActionPanel';
import PriceHistoryPanel from './PriceHistoryPanel';
import {assessPriceHistory,type HistoricalPriceResponse,type PriceHistoryAssessment} from './price-history-model';
import {draftIssuerThesis} from './automatic-thesis';
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
 const [marketQuote,setMarketQuote]=useState<MarketValuationClose|null>(null);
 const [historical,setHistorical]=useState<HistoricalPriceResponse|null>(null);
 const [priceHistoryAssessment,setPriceHistoryAssessment]=useState<PriceHistoryAssessment|null>(null);
 const [historicalIssue,setHistoricalIssue]=useState('');
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
  setError('');setMarketIssue('');setHistoricalIssue('');setHistorical(null);setPriceHistoryAssessment(null);setCompany(null);setMarketQuote(null);setAssessment(null);setSavedMessage('');setThesis('');setInvalidation('');
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
   const asOf=nyToday();
   let priceHistory:HistoricalPriceResponse|null=null;
   try{
    const h=await fetch('/api/market/long-history?ticker='+encodeURIComponent(symbol));
    const body=await h.json() as HistoricalPriceResponse&{error?:string};
    if(!h.ok||body.ticker!==symbol||body.provider!=='Alpaca'||body.feed!=='IEX'||!Array.isArray(body.bars))throw Error(body.error||'Completed historical IEX prices unavailable');
    priceHistory=body;
   }catch(e){setHistoricalIssue(e instanceof Error?e.message:'Completed historical prices unavailable')}
   const trend=assessPriceHistory(priceHistory,asOf);
   const check=assessConvictionReadiness(sec,market,asOf);
   const draft=draftIssuerThesis(sec,check,market,asOf,trend);
   setCompany(sec);
   setMarketQuote(market);
   setHistorical(priceHistory);
   setPriceHistoryAssessment(trend);
   setAssessment(check);
   setThesis(draft.thesis);
   setInvalidation(draft.invalidation);
   setSavedMessage('ATLAS automatically prepared a dated research draft from SEC evidence. Review or edit it before saving. It is not verified or monitored.');
   try{const brief=createConvictionActionBrief(sec,check,asOf);saveResearchSummary(localStorage,{ticker:sec.ticker,createdAt:new Date().toISOString(),headline:brief.headline,finding:brief.finding,action:brief.action,source:sec.source,verdict:check.verdict})}catch{setSavedMessage('Research loaded, but its Watchlist summary could not be saved. Existing saved records were kept.')}
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
   <ConvictionActionPanel company={company} assessment={assessment} asOf={nyToday()}/>
   <details className="atlas-details atlas-conviction-deep-dive">
    <summary>See historical SEC financials, scenario assumptions, trading, cash and financing evidence</summary>
   <div className="atlas-key-return">
    <div><span className="atlas-glance-label">SEC revenue growth</span><strong className={"atlas-glance-value "+(assessment.observed.revenueGrowthPct===null?"":assessment.observed.revenueGrowthPct>=0?"atlas-tone-positive":"atlas-tone-negative")}>{pct(assessment.observed.revenueGrowthPct)}</strong><small>FY {assessment.observed.fiscalYear??'unknown'}</small></div>
    <div><span className="atlas-glance-label">ATLAS-derived PP&amp;E-only FCF</span><strong className={"atlas-glance-value "+(assessment.observed.freeCashFlow===null?"":assessment.observed.freeCashFlow>=0?"atlas-tone-positive":"atlas-tone-negative")}>{currency(assessment.observed.freeCashFlow)}</strong><small>Company SEC fiscal period</small></div>
    <div><span className="atlas-glance-label">PP&amp;E-only FCF margin</span><strong className={"atlas-glance-value "+(assessment.observed.fcfMarginPct===null?"":assessment.observed.fcfMarginPct>=0?"atlas-tone-positive":"atlas-tone-negative")}>{pct(assessment.observed.fcfMarginPct)}</strong><small>ATLAS-derived, not a GAAP-reported metric</small></div>
    <p className="chart-note">{PP_AND_E_FCF_DISCLOSURE}</p>
    <div><span className="atlas-glance-label">Indicative annual P/E</span><strong className="atlas-glance-value">{assessment.observed.fyPe===null?'N/A':assessment.observed.fyPe.toFixed(1)+'×'}</strong><small>{assessment.observed.asOfDate??'Quote missing'} · not TTM or forward</small></div>
   </div>
   {assessment.fundingRisk.status!=='unknown'&&<section className={'atlas-conviction-funding '+(assessment.fundingRisk.status==='nonnegative_fcf'?'atlas-funding-neutral':'atlas-funding-alert')}>
    <strong>{assessment.fundingRisk.headline}</strong>
    <p>{assessment.fundingRisk.detail}</p>
    {assessment.fundingRisk.status!=='nonnegative_fcf'&&<p><strong>Research priority:</strong> Explain where the cash went, whether growth investment is productive, what funding is available, and how future share issuance could affect your ownership.</p>}
   </section>}
   <OperatingScenariosPanel company={company} asOf={nyToday()}/>
   <PriceHistoryPanel ticker={company.ticker} history={historical} assessment={priceHistoryAssessment??undefined} asOf={nyToday()}/>
   {historicalIssue&&<p className="chart-note"><strong>Historical market-data limitation:</strong> {historicalIssue}</p>}
   <MarketCapEvidencePanel company={company} quote={marketQuote} asOf={nyToday()}/>
   <FinancingAutomationPanel company={company} asOf={nyToday()}/>
   <details className="atlas-details"><summary>Historical annual cash and dilution audit</summary><SurvivalEvidencePanel company={company} asOf={assessment.observed.asOfDate??nyToday()}/></details>
   <p className="chart-note"><strong>Source:</strong> <a href={company.source} target="_blank" rel="noopener noreferrer">SEC company financial facts ↗</a>. Missing or delayed figures remain unknown. An attractive reported metric is not evidence of mispricing.</p>
   </details>
   <details className="atlas-details atlas-conviction-deep-dive"><summary>See source coverage for all 11 research checks</summary>
    <p className="atlas-gates-explainer">All {assessment.totalCount} evidence-availability checks ran automatically; a check mark means <strong>ATLAS evaluated the source status</strong>, NOT that all required data were obtained or an unimplemented research engine has finished. Missing SEC disclosures remain unknown and never receive a positive investment score.</p>
    <div className="atlas-conviction-gates">{assessment.requirements.map(item=><div key={item.key}><div className="atlas-gate-heading"><strong><span className="atlas-evaluation-check">✓</span> {item.label}</strong><span className={'atlas-gate-progress atlas-progress-'+item.progress}>{item.progress==='verified'?'Evidence sourced':item.progress==='partially_sourced'?'Sources incomplete':item.progress==='engine_pending'?'Research model not built':'Source unavailable'}</span></div><p>{item.detail}</p></div>)}</div>
   </details>
   <details className="atlas-details atlas-conviction-thesis-details"><summary>View and edit the automatically drafted thesis and invalidation checklist</summary>
   <div className="atlas-conviction-thesis">
    <strong>ATLAS automatically prepared a research thesis and invalidation checklist</strong>
    <p className="chart-note">These editable notes come from available issuer evidence and known research gaps, not from an independently verified fair-value or competitive-moat engine. Saving remains optional; automatic monitoring is not enabled.</p>
    <label>Automatically prepared hypothesis — edit before saving<textarea rows={10} value={thesis} onChange={e=>setThesis(e.target.value)} placeholder="A documented business change, valuation disconnect, or credible growth catalyst…"/></label>
    <label>Disconfirming evidence checklist — not active alerts<textarea rows={9} value={invalidation} onChange={e=>setInvalidation(e.target.value)} placeholder="Financial thresholds, dilution, loss of a major customer or failed commercialization…"/></label>
    <button className="button secondary" type="button" disabled={!thesis.trim()||!invalidation.trim()} onClick={saveThesis}>Save timestamped thesis draft</button>
    {savedMessage&&<p role="status">{savedMessage}</p>}
    {existing.length>0&&<details className="atlas-details"><summary>Previous saved thesis drafts ({existing.length} recent)</summary>{existing.map(item=><div className="atlas-thesis-history" key={item.createdAt}><strong>{new Date(item.createdAt).toLocaleString('en-US')}</strong><p>{item.thesis}</p><p><strong>Invalidation:</strong> {item.invalidation}</p></div>)}</details>}
   </div>
   </details>
  </div>}
 </section>;
}
