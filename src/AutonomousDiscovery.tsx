import {useSyncExternalStore} from 'react';
import {deriveRankingMetrics} from './ranking-model';
import {scanCounts,coverageCauseCounts} from './autonomous-screen';
import {flagIndicativeFyValuation} from './valuation-triage';
import SurvivalEvidencePanel from './SurvivalEvidencePanel';
import MarketCapEvidencePanel from './MarketCapEvidencePanel';
import FinancingAutomationPanel from './FinancingAutomationPanel';
import PriceHistoryPanel from './PriceHistoryPanel';
import {PP_AND_E_FCF_DISCLOSURE} from './financial-methodology-eligibility';
import {reportedFinancialEvidence} from './reported-financial-evidence';
import {autonomousDiscoveryController,DISCOVERY_BATCH_SIZE,easternDate,type DiscoveryController} from './autonomous-discovery-controller';

const BATCH=DISCOVERY_BATCH_SIZE;
const money=(n:number|null)=>n===null?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
const dollars=(n:number|null)=>n===null?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const pct=(n:number|null)=>n===null?'N/A':(n>=0?'+':'')+n.toFixed(1)+'%';
export const financialScreenOutcomeSummary=(summary:ReturnType<typeof scanCounts>)=>`Other financial-screen outcomes: ${summary.failed} below provisional thresholds, ${summary.incomplete} with incomplete financial evidence, ${summary.stale} stale or unestablished annual records, ${summary.accountingReview} accounting-review flags, ${summary.sourceFailures} blocked/failed SEC sources.`;
export default function AutonomousDiscovery({onResearch,onConviction,controller=autonomousDiscoveryController}:{onResearch?:(ticker:string)=>void;onConviction?:(ticker:string)=>void;controller?:DiscoveryController}){
 const {universe,batchCount,scannedBatches,allListed,screened,failed,researchRecords,candidates,briefing,busy,error,progress,done,quotesChecked}=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
 const summary=scanCounts(screened,failed.length,allListed.length);
 const coverage=coverageCauseCounts(screened,failed.length);
 return <section className="panel real-panel atlas-autonomous-discovery">
  <div className="panel-head"><div><span className="eyebrow">ATLAS / AUTONOMOUS INVESTMENT DISCOVERY</span><h3>Discover companies without entering a ticker</h3></div><span className="tag">Real SEC universe · Initial research stage</span></div>
  <p className="description"><strong>ATLAS chooses the companies to examine.</strong> Each scan draws the next batch from the public SEC company index, checks actual annual financials and investigates the leading preliminary matches. No favorite ticker list drives discovery.</p>
  <div className="atlas-autonomous-actions"><label>Companies to examine per run<select aria-label="Number of SEC batches" value={batchCount} onChange={e=>controller.setBatchCount(Number(e.target.value))} disabled={busy}><option value={1}>24 companies · 1 batch</option><option value={3}>Up to 72 companies · 3 batches</option></select></label><button type="button" className="button secondary" disabled={busy} onClick={controller.resetCursor}>Restart universe cursor</button></div>
  <button type="button" className="button primary atlas-autonomous-cta" onClick={()=>void controller.start()} disabled={busy}>{busy?'Discovering real companies…':done?'Discover more companies →':'Discover Opportunities →'}</button>
  <p className="chart-note"><strong>Current scope:</strong> Select 1 or 3 consecutive batches of up to {BATCH} SEC-indexed tickers per run ({batchCount*BATCH} maximum). Progress is recorded after a completed run, not on a timer. The cursor advances across the complete retrieved index on successive scans. SEC ticker inclusion alone does not verify exchange, current listing, sector, market cap or liquidity. This is not yet a whole-universe, complete investment-selection run.</p>
  {progress&&<p className="atlas-summary-line" role="status">{progress}</p>}
  {error&&<p className="opportunity-uncertainty" role="alert"><strong>Scan unavailable:</strong> {error}</p>}
  {universe&&<div className="atlas-autonomous-results">
   <div className="atlas-autonomous-metrics">
    <div><span>SEC ticker universe</span><strong>{universe.total.toLocaleString()}</strong><small>Index entries, not screened companies</small></div>
    <div><span>This batch enumerated</span><strong>{summary.enumerated}</strong><small>Index offsets {universe.start}–{universe.start+allListed.length-1} · {scannedBatches} batch(es)</small></div>
    <div><span>SEC financials checked</span><strong>{summary.financialRecordsChecked}</strong><small>{summary.sourceFailures} source failure(s)</small></div>
    <div><span>Preliminary passes</span><strong>{summary.preliminary}</strong><small>Not confirmed bargains</small></div>
   </div>
   <p className="chart-note"><strong>Universe index:</strong> <a href={universe.indexUrl} target="_blank" rel="noopener noreferrer">SEC company ticker file ↗</a> · fetched {new Date(universe.retrievedAt).toLocaleString('en-US')}. {universe.scope}</p>
   {done&&<div className="atlas-autonomous-funnel">
    <strong>Screening audit · this run only</strong>
    <p><strong>{summary.enumerated}</strong> enumerated → <strong>{summary.financialRecordsChecked}</strong> annual SEC records checked → <strong>{summary.preliminary}</strong> preliminary financial passes → <strong>{quotesChecked}</strong> completed-price lookups attempted → <strong>0</strong> fully verified high-conviction investments.</p>
    <p className="chart-note">{financialScreenOutcomeSummary(summary)} Up to eight preliminarily eligible companies receive valuation and split-adjusted long-term price research. Price signals affect only this provisional subset.</p>
    <p className="chart-note"><strong>Unresolved screening evidence, this run:</strong> {coverage.absentSourceFact} issuer(s) without a supported source fact, {coverage.unsupportedTaxonomy} with an unsupported IFRS-only taxonomy, {coverage.incompatibleFiscalPeriods} with nonmatching or nonqualifying annual periods, {coverage.missingComparablePriorYear} without a comparable prior revenue year, {coverage.unusableValue} with a nonpositive or invalid required value, {coverage.sourcePresenceUnknown} without source-tag metadata, and {coverage.sourceRetrievalFailure} source retrieval failure(s). Causes can overlap for one issuer. {coverage.incompleteWithObservedFailures} incomplete issuer(s) also have an independently observable threshold failure; incomplete is not a pass.</p>
   </div>}
{done&&<div className="atlas-autonomous-leads">
     <h4>Research priorities from this independently discovered run</h4>
     {!candidates.length&&<p className="opportunity-uncertainty"><strong>No candidates passed this run's initial financial screen.</strong> ATLAS will not manufacture a result. Select “Discover more companies” to examine the next index batch.</p>}
     {candidates.map((item,i)=><article className="atlas-autonomous-lead" key={item.company.ticker}>
      <div className="atlas-autonomous-heading"><div><small>Research candidate {i+1} · not a buy rating</small><strong>{item.company.ticker} · {item.company.name}</strong></div><span>INSUFFICIENT EVIDENCE</span></div>
      <div className="atlas-key-return">
       <div><span className="atlas-glance-label">Reported annual revenue growth</span><strong className={'atlas-glance-value '+(item.screen.growth!==null&&item.screen.growth>=0?'atlas-tone-positive':'atlas-tone-negative')}>{pct(item.screen.growth)}</strong></div>
       <div><span className="atlas-glance-label">Free cash flow margin</span><strong className={'atlas-glance-value '+(item.screen.fcfMargin!==null&&item.screen.fcfMargin>=0?'atlas-tone-positive':'atlas-tone-negative')}>{pct(item.screen.fcfMargin)}</strong></div>
       <div><span className="atlas-glance-label">Indicative FY P/E</span><strong className="atlas-glance-value">{item.valuation?.pe==null?'N/A':item.valuation.pe.toFixed(1)+'×'}</strong></div>
       <div><span className="atlas-glance-label">Latest completed IEX close</span><strong className="atlas-glance-value">{money(item.quote?.price??null)}</strong><small>{item.quote?.sessionDate??'Price unavailable'}</small></div>
      </div>
      <div className={'atlas-autonomous-valuation '+(flagIndicativeFyValuation(item.valuation).level==='high_multiple'?'atlas-valuation-red':flagIndicativeFyValuation(item.valuation).level==='elevated_multiple'?'atlas-valuation-amber':'')}><strong>{flagIndicativeFyValuation(item.valuation).headline}</strong><p>{flagIndicativeFyValuation(item.valuation).explanation}</p></div>
      <p className="chart-note"><strong>Combined research priority:</strong> {item.priority.score===null?'Unscored':item.priority.score.toFixed(0)+'/100'} · {item.priority.priceWeighted?'80% SEC fundamentals and indicative valuation + 20% historical price trend':'Fundamentals-only provisional score; comparable historical price data missing'}. This is a sorting heuristic among up to eight preliminary candidates, not a predicted return or buy verdict.</p>
      <PriceHistoryPanel ticker={item.company.ticker} history={item.history} assessment={item.trend} asOf={easternDate()}/>
      {item.historyIssue&&<p className="chart-note"><strong>Historical source limitation:</strong> {item.historyIssue}</p>}
      <MarketCapEvidencePanel company={item.company} quote={item.quote} asOf={easternDate()}/>
      <FinancingAutomationPanel company={item.company} asOf={easternDate()}/>
      <SurvivalEvidencePanel company={item.company} asOf={item.quote?.sessionDate??easternDate()}/>
      <details className="atlas-details"><summary>Verify SEC revenue, cash flow and calculated margins</summary>{(()=>{const m=deriveRankingMetrics(item.company);const tag=item.company.metrics.find(x=>x.name==='Revenue');const annual=tag?.values.find(x=>x.year===m.year);const prior=tag?.values.find(x=>x.year===(m.year??0)-1);return <><p><strong>Selected revenue field:</strong> {tag?.tag??'Not identified'} · {tag?.selectionNote??'Original SEC source must be checked'}</p><p><strong>Same-tag consolidated-scale revenue:</strong> current FY {dollars(m.revenue)} · prior FY {dollars(prior?.value??null)} · period end {annual?.end??'unknown'}.</p><p><strong>Operating cash flow:</strong> {dollars(item.company.metrics.find(x=>x.name==='Operating cash flow')?.values.find(x=>x.end===annual?.end)?.value??null)} · <strong>PP&amp;E cash purchases:</strong> {dollars(m.capex)} · <strong>ATLAS-derived PP&amp;E-only FCF:</strong> {dollars(m.fcf)}.</p><p>{PP_AND_E_FCF_DISCLOSURE} Revenue growth and FCF margin are ATLAS calculations, not directly reported SEC metrics.</p><p><a href={item.company.source} target="_blank" rel="noopener noreferrer">Inspect original SEC tagged financial facts ↗</a></p></>})()}</details>
      <p className="chart-note"><strong>FY filing:</strong> {item.screen.filed??'Unknown'}. <strong>Reason surfaced:</strong> {item.screen.reasons.join('; ')}. {item.priceIssue||item.valuation?.reason||'Price-sensitive earnings valuation incomplete.'}</p>
      <p className="opportunity-uncertainty"><strong>Still not validated:</strong> verified current market cap, exchange, consolidated liquidity, dilution, debt/runway, sector durability, institutional consensus, original news timing and 5-year valuation scenarios. These are NOT investment recommendations.</p>
      <div className="atlas-ranking-controls"><a href={item.company.source} target="_blank" rel="noopener noreferrer">Inspect original SEC financial data ↗</a>{onResearch&&<button className="button secondary" type="button" onClick={()=>onResearch(item.company.ticker)}>Research company →</button>}{onConviction&&<button className="button secondary" type="button" onClick={()=>onConviction(item.company.ticker)}>Check conviction gates →</button>}</div>
     </article>)}
    </div>}
{done && researchRecords.length > 0 && briefing && (
        <div className="atlas-autonomous-leads">
          <h4>Discovery Briefing</h4>
          <p className="chart-note">Summary of findings from this run.</p>
          <div className="atlas-briefing-summary">
            <p><strong>Scan completed:</strong> {briefing.scanCompletedAt}</p>
            <p><strong>Companies examined:</strong> {briefing.issuersExamined}</p>
            <p><strong>Emerging strength leads:</strong> {briefing.leads.filter(l => l.emergingStrength === 'improving').length}</p>
          </div>
          {briefing.leads.map((lead, index) => (
            <article className="atlas-autonomous-lead" key={lead.ticker}>
              <div className="atlas-autonomous-heading">
                <div>
                  <small>Lead {index + 1}</small>
                  <strong>{lead.ticker} · {lead.companyName}</strong>
                </div>
                <span>NOT A BUY RATING</span>
              </div>
              <div className="atlas-key-return">
                <div>
                  <span className="atlas-glance-label">Preliminary Screen Status</span>
                  <strong>{lead.preliminaryScreenStatus.replaceAll('_', ' ')}</strong>
                </div>
                <div>
                  <span className="atlas-glance-label">Revenue Growth</span>
                  <strong>{pct(lead.revenueGrowth)}</strong>
                </div>
                <div>
                  <span className="atlas-glance-label">FCF Margin</span>
                  <strong>{pct(lead.fcfMargin)}</strong>
                </div>
                <div>
                  <span className="atlas-glance-label">Annual P/E</span>
                  <strong>{lead.annualPe === null ? 'N/A' : lead.annualPe.toFixed(1) + '×'}</strong>
                </div>
              </div>
              <p className="chart-note"><strong>Emerging Strength:</strong> {lead.emergingStrength}</p>
              <p className="chart-note"><strong>Screening Reasons:</strong> {lead.screeningReasons.join('; ')}</p>
              {lead.evidenceLimitations && (
                <p className="chart-note"><strong>Evidence Limitations:</strong> {lead.evidenceLimitations.join('; ')}</p>
              )}
            </article>
          ))}
        </div>
      )}
   {done&&failed.length>0&&<details className="atlas-details"><summary>Source failures ({failed.length})</summary>{failed.map((x,i)=><p key={x.ticker+'-'+i}><strong>{x.ticker}:</strong> {x.reason}</p>)}</details>}
   {done&&<details className="atlas-details"><summary>Every issuer scanned and why it passed or failed</summary>{allListed.map(row=>{const match=screened.find(s=>s.ticker===row.ticker),issue=failed.find(f=>f.ticker===row.ticker),record=researchRecords.find(item=>item.company.ticker===row.ticker);const evidence=record?reportedFinancialEvidence(record.company):null;return <p key={row.cik}><strong>{row.ticker} · {row.name}</strong> — {match?match.status.replaceAll('_',' ')+(match.reasons.length?' ('+match.reasons.join('; ')+')':''):issue?'SEC source retrieval failed: '+issue.reason:'Not examined'} · CIK {row.cik}{match?.status==='incomplete_financials'&&evidence&&<> · <strong>SEC-reported FY figures:</strong> revenue {dollars(evidence.revenue?.value??null)}, net income {dollars(evidence.netIncome?.value??null)}, operating cash flow {dollars(evidence.operating?.value??null)}{evidence.productiveAssets&&`, property/equipment/intangible-asset purchases ${dollars(evidence.productiveAssets.value)} (accession ${evidence.productiveAssets.accession})`}{evidence.cashAfterProductiveAssets!==null&&`, cash after those purchases ${dollars(evidence.cashAfterProductiveAssets)} (separate from ATLAS screening FCF)`}. <a href={record!.company.source} target="_blank" rel="noopener noreferrer">SEC tagged facts ↗</a></>}</p>})}</details>}
  </div>}
 </section>;
}
