import {useState} from 'react';
import {annualPeFromSec,defaultRankWeights,rankCompanies,deriveRankingMetrics,assessEmergingFcfStrength,type AnnualPe,type MarketValuationClose,type SecCompany,type FcfStrengthAssessment} from './ranking-model';
import {initialAutonomousScreen,scanCounts,coverageCauseCounts,type ScreenResult} from './autonomous-screen';
import {writeSavedPasses} from './autonomous-pass-ledger';
import {flagIndicativeFyValuation} from './valuation-triage';
import {buildDiscoveryBriefing,type DiscoveryBriefingInput,type DiscoveryBriefingSnapshot} from './discovery-briefing-model';
import {writeDiscoveryBriefing} from './discovery-briefing-storage';
import SurvivalEvidencePanel from './SurvivalEvidencePanel';
import MarketCapEvidencePanel from './MarketCapEvidencePanel';
import FinancingAutomationPanel from './FinancingAutomationPanel';
import PriceHistoryPanel from './PriceHistoryPanel';
import {assessPriceHistory,combineResearchPriority,type HistoricalPriceResponse,type PriceHistoryAssessment} from './price-history-model';
import {appendIndustryComparabilityLimitations} from './industry-classification';
import {buildResearchHistoryRecords,createResearchHistoryRunId} from './research-history-model';
import {appendBrowserResearchHistory} from './research-history-storage';
import {reportedFinancialEvidence} from './reported-financial-evidence';
type Listed={ticker:string;name:string;cik:number};
type UniversePage={total:number;start:number;nextCursor:number;completedCycle:boolean;rows:Listed[];indexUrl:string;retrievedAt:string;error?:string;seedTickersUsed:boolean;scope:string};
type Candidate={company:SecCompany;screen:ScreenResult;valuation:AnnualPe|null;quote:MarketValuationClose|null;priceIssue:string|null;history:HistoricalPriceResponse|null;trend:PriceHistoryAssessment;historyIssue:string|null;priority:{score:number|null;priceWeighted:boolean}};
type RecordEntry={company:SecCompany;screen:ScreenResult;emerging:FcfStrengthAssessment};
const BATCH=24,CURSOR_KEY='atlas.autonomous.sec.cursor.v1';
const initialCursor=()=>{try{const n=Number(localStorage.getItem(CURSOR_KEY)||0);return Number.isSafeInteger(n)&&n>=0?n:0}catch{return 0}};
const money=(n:number|null)=>n===null?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
const dollars=(n:number|null)=>n===null?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const pct=(n:number|null)=>n===null?'N/A':(n>=0?'+':'')+n.toFixed(1)+'%';
const easternDate=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const x=Object.fromEntries(p.filter(k=>k.type!=='literal').map(k=>[k.type,k.value]));return x.year+'-'+x.month+'-'+x.day};
export default function AutonomousDiscovery({onResearch,onConviction}:{onResearch?:(ticker:string)=>void;onConviction?:(ticker:string)=>void}){
const [cursor,setCursor]=useState(initialCursor);
  const [universe,setUniverse]=useState<UniversePage|null>(null);
  const [batchCount,setBatchCount]=useState(1);
  const [scannedBatches,setScannedBatches]=useState(0);
  const [allListed,setAllListed]=useState<Listed[]>([]);
  const [screened,setScreened]=useState<ScreenResult[]>([]);
  const [failed,setFailed]=useState<{ticker:string;reason:string}[]>([]);
  const [researchRecords,setResearchRecords]=useState<RecordEntry[]>([]); // eslint-disable-line no-unused-vars
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [briefing,setBriefing]=useState<DiscoveryBriefingSnapshot | null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [progress,setProgress]=useState('');
  const [done,setDone]=useState(false);
  const [quotesChecked,setQuotesChecked]=useState(0);
 async function discover(){
  if(busy)return;
   setBusy(true);setDone(false);setUniverse(null);setScreened([]);setCandidates([]);setFailed([]);setResearchRecords([]);setError('');setQuotesChecked(0);setScannedBatches(0);setAllListed([]);
  setProgress('Enumerating actual companies from the SEC ticker index…');
  try{
   const today=easternDate(),records:RecordEntry[]=[],sourceIssues:{ticker:string;reason:string}[]=[];
   const listed:Listed[]=[];
   let firstPage:UniversePage|null=null,nextCursor=cursor,completed=0;
   // A single explicit scan can walk several consecutive SEC index batches.
   // Two company-fact requests at once; never send the entire universe at SEC.
   for(let batch=0;batch<batchCount;batch++){
    setProgress('Enumerating SEC company batch '+(batch+1)+' of '+batchCount+'…');
    const r=await fetch('/api/autonomous/universe?cursor='+nextCursor+'&limit='+BATCH);
    const page=await r.json() as UniversePage;
    if(!r.ok||!Array.isArray(page.rows)||!page.indexUrl?.startsWith('https://www.sec.gov/'))throw Error(page.error||'Cannot enumerate the public SEC company universe');
    if(!firstPage)firstPage=page;
    if(page.total!==firstPage.total)throw Error('SEC index changed size during this run; results withheld to avoid misleading scan counts');
    listed.push(...page.rows);
    for(let i=0;i<page.rows.length;i+=2){
     const group=page.rows.slice(i,i+2);
     await Promise.all(group.map(async ({ticker})=>{
       try{
        const response=await fetch('/api/sec/company?ticker='+encodeURIComponent(ticker));
        const company=await response.json() as SecCompany&{error?:string};
        if(!response.ok||!company.source?.startsWith('https://data.sec.gov/')||company.ticker!==ticker||!Array.isArray(company.metrics))throw Error(company.error||'SEC annual source incomplete');
        const screen=initialAutonomousScreen(company,today);
        const emerging = assessEmergingFcfStrength(company);
        records.push({company,screen,emerging});
       }catch(e){sourceIssues.push({ticker,reason:e instanceof Error?e.message:'SEC company facts unavailable'})}
      setProgress('Checked '+(records.length+sourceIssues.length)+' / '+(batchCount*BATCH)+' planned SEC companies · batch '+(batch+1)+' / '+batchCount);
     }));
    }
    nextCursor=page.nextCursor;completed++;
    setScannedBatches(completed);
    if(page.completedCycle)break;
   }
   if(!firstPage)throw Error('No SEC index batch was returned');
   setUniverse(firstPage);setAllListed(listed);
   const passes=records.filter(x=>x.screen.status==='preliminary_pass')
    .sort((a,b)=>(b.screen.score??-1)-(a.screen.score??-1)||a.company.ticker.localeCompare(b.company.ticker));
    setScreened(records.map(x=>x.screen));setFailed(sourceIssues);setResearchRecords(records);
    // Store records for potential future use in UI or analytics
   writeSavedPasses(passes.filter(x=>x.screen.score!==null&&x.screen.filed!==null).map(x=>({ticker:x.company.ticker,observedAt:today,annualFiled:x.screen.filed!,preliminaryScore:x.screen.score!})),today);
   // Only the leading provisional passes receive price requests in this first
   // bounded scan. This must NEVER be interpreted as full market valuation coverage.
   const subset=passes.slice(0,8),research:Candidate[]=[];
   for(let i=0;i<subset.length;i++){
    const row=subset[i];setProgress('Checking completed IEX prices for '+row.company.ticker+' ('+(i+1)+' / '+subset.length+')');
    let quote:MarketValuationClose|null=null,valuation:AnnualPe|null=null,priceIssue:string|null=null;
    try{
     const response=await fetch('/api/market/valuation-close?ticker='+encodeURIComponent(row.company.ticker));
     const body=await response.json() as MarketValuationClose&{error?:string};
     if(!response.ok||body.ticker!==row.company.ticker||body.feed!=='IEX'||!body.completedSession)throw Error(body.error||'Completed IEX close not verified');
     quote=body;
     valuation=annualPeFromSec(row.company,body);
    }catch(e){priceIssue=e instanceof Error?e.message:'Completed-price data unavailable'}
    let history:HistoricalPriceResponse|null=null,historyIssue:string|null=null;
    try{
     const h=await fetch('/api/market/long-history?ticker='+encodeURIComponent(row.company.ticker));
     const body=await h.json() as HistoricalPriceResponse&{error?:string};
     if(!h.ok||body.ticker!==row.company.ticker||!Array.isArray(body.bars))throw Error(body.error||'Split-adjusted weekly prices unavailable');
     history=body;
    }catch(e){historyIssue=e instanceof Error?e.message:'Historical price source unavailable'}
    const trend=assessPriceHistory(history,today);
    research.push({...row,quote,valuation,priceIssue,history,trend,historyIssue,priority:{score:null,priceWeighted:false}});
    setQuotesChecked(i+1);
   }
   const valuationMap=Object.fromEntries(research.map(x=>[x.company.ticker,x.valuation?.pe??null]));
   const fundamental=rankCompanies(research.map(x=>x.company),defaultRankWeights,valuationMap);
   const fundamentals=new Map(fundamental.map(x=>[x.ticker,x.score]));
   const rankings=new Map(fundamental.map(x=>[x.ticker,x]));
   for(const item of research)item.priority=combineResearchPriority(fundamentals.get(item.company.ticker)??null,item.trend);
   // P/E cautions come first. A 20% stock-price trend is used only for
   // successfully fetched, dated, 1Y+3Y split-adjusted history in this small
   // top-eight research sample. Missing history never becomes a bullish signal.
   research.sort((a,b)=>flagIndicativeFyValuation(a.valuation).rank-flagIndicativeFyValuation(b.valuation).rank||
    (b.priority.score??-1)-(a.priority.score??-1)||
    (b.priority.priceWeighted?1:0)-(a.priority.priceWeighted?1:0)||
    a.company.ticker.localeCompare(b.company.ticker));
    setCandidates(research);
    const scanCompletedAt=new Date().toISOString();
    const runId=createResearchHistoryRunId(scanCompletedAt);
    const historyRecords=buildResearchHistoryRecords({
      completed:true,completedAt:scanCompletedAt,runId,assessments:records,
      enrichments:research.map(item=>({ticker:item.company.ticker,valuation:item.valuation,quote:item.quote,ranking:rankings.get(item.company.ticker)??null,priceIssue:item.priceIssue,historyIssue:item.historyIssue}))
    });

    // Build discovery briefing from results
    const briefingInput: DiscoveryBriefingInput = {
      scanCompletedAt,
      issuersExamined: records.length,
      leads: research.map(item => {
        // Find the matching record for emerging strength
        const record = records.find(r => r.company.ticker === item.company.ticker);
        // Use only valid Emerging Strength statuses: improving, not_improving, insufficient_evidence
        let emergingStatus: 'improving' | 'not_improving' | 'insufficient_evidence' = 'insufficient_evidence';
        if (record) {
          emergingStatus = record.emerging.status;
        }
        return {
          ticker: item.company.ticker,
          companyName: item.company.name,
          preliminaryScreenStatus: item.screen.status,
          revenueGrowth: item.screen.growth,
          fcfMargin: item.screen.fcfMargin,
          annualPe: item.valuation?.pe ?? null,
          emergingStrength: emergingStatus,
          screeningReasons: item.screen.reasons,
          evidenceLimitations: appendIndustryComparabilityLimitations(
            item.priceIssue || item.historyIssue ? [item.priceIssue || '', item.historyIssue || ''].filter(Boolean) as string[] : null,
            item.company.classification
          )
        };
      })
    };

    const briefingSnapshot = buildDiscoveryBriefing(briefingInput);
    setBriefing(briefingSnapshot);

    // Save briefing snapshot to localStorage
    try{writeDiscoveryBriefing(globalThis.localStorage, briefingSnapshot)}catch{}
    const historyResult=appendBrowserResearchHistory(historyRecords);
    const historyNote=historyResult.status==='saved'
      ?' Browser-local history saved '+historyResult.saved+' issuer assessment(s)'+(historyResult.dropped?' and evicted '+historyResult.dropped+' oldest record(s) under the 1,200-record retention cap.':'.')
      :' Browser-local assessment history was not saved ('+historyResult.status+'); the completed scan remains available in this session.';
    setProgress('Completed provisional SEC screening and price research. Price history is weighted at 20% only when comparable 1Y and 3Y observations exist; valuations remain unverified.'+historyNote);
    setDone(true);
    setCursor(nextCursor);
    try{localStorage.setItem(CURSOR_KEY,String(nextCursor))}catch{}
   }catch(e){
    setError(e instanceof Error?e.message:'Autonomous scan unavailable');
    setProgress('Scan failed. No companies were silently substituted.');
   }finally{setBusy(false)}
 }
 const summary=scanCounts(screened,failed.length,allListed.length);
 const coverage=coverageCauseCounts(screened,failed.length);
 return <section className="panel real-panel atlas-autonomous-discovery">
  <div className="panel-head"><div><span className="eyebrow">ATLAS / AUTONOMOUS INVESTMENT DISCOVERY</span><h3>Discover companies without entering a ticker</h3></div><span className="tag">Real SEC universe · Initial research stage</span></div>
  <p className="description"><strong>ATLAS chooses the companies to examine.</strong> Each scan draws the next batch from the public SEC company index, checks actual annual financials and investigates the leading preliminary matches. No favorite ticker list drives discovery.</p>
  <div className="atlas-autonomous-actions"><label>Companies to examine per run<select aria-label="Number of SEC batches" value={batchCount} onChange={e=>setBatchCount(Number(e.target.value))} disabled={busy}><option value={1}>24 companies · 1 batch</option><option value={3}>Up to 72 companies · 3 batches</option></select></label><button type="button" className="button secondary" disabled={busy} onClick={()=>{setCursor(0);try{localStorage.setItem(CURSOR_KEY,'0')}catch{}setProgress('SEC index scan cursor reset. The next scan starts at index position 0.')}}>Restart universe cursor</button></div>
  <button type="button" className="button primary atlas-autonomous-cta" onClick={()=>void discover()} disabled={busy}>{busy?'Discovering real companies…':done?'Discover more companies →':'Discover Opportunities →'}</button>
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
    <p className="chart-note">Other financial-screen outcomes: {summary.failed} below provisional thresholds, {summary.incomplete} requiring accounting reconciliation for this screen, {summary.stale} stale or unestablished annual records, {summary.accountingReview} accounting-review flags, {summary.sourceFailures} blocked/failed SEC sources. Up to eight preliminarily eligible companies receive valuation and split-adjusted long-term price research. Price signals affect only this provisional subset.</p>
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
      <details className="atlas-details"><summary>Verify SEC revenue, cash flow and calculated margins</summary>{(()=>{const m=deriveRankingMetrics(item.company);const tag=item.company.metrics.find(x=>x.name==='Revenue');const annual=tag?.values.find(x=>x.year===m.year);const prior=tag?.values.find(x=>x.year===(m.year??0)-1);return <><p><strong>Selected revenue field:</strong> {tag?.tag??'Not identified'} · {tag?.selectionNote??'Original SEC source must be checked'}</p><p><strong>Same-tag consolidated-scale revenue:</strong> current FY {dollars(m.revenue)} · prior FY {dollars(prior?.value??null)} · period end {annual?.end??'unknown'}.</p><p><strong>Operating cash flow:</strong> {dollars(item.company.metrics.find(x=>x.name==='Operating cash flow')?.values.find(x=>x.end===annual?.end)?.value??null)} · <strong>Capex:</strong> {dollars(m.capex)} · <strong>FCF after capex:</strong> {dollars(m.fcf)}.</p><p><strong>Calculation:</strong> revenue growth = current annual revenue / prior annual revenue − 1; FCF margin = (operating cash flow − capex) / revenue. Values are SEC facts, not independently normalized recurring earnings.</p><p><a href={item.company.source} target="_blank" rel="noopener noreferrer">Inspect original SEC tagged financial facts ↗</a></p></>})()}</details>
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
