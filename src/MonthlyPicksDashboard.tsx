import {useEffect,useState} from 'react';
import InvestmentOutcomeSimulator from './InvestmentOutcomeSimulator';
import CatalystVerificationPanel from './CatalystVerificationPanel';
import EconomicSignificancePanel from './EconomicSignificancePanel';
import {distinctIssuers,retainPickLeads,thisMonth,selectIssuerReviewBatch,type PickLead} from './picks-research';
import {headlineReferencesIssuer,issuerSearchName} from './issuer-news-identity';
import type {FilingEvidenceResult} from './FilingEvidence';
import {assessCatalystFundamentalBridge} from './catalyst-fundamental-bridge';
import {assessEconomicSignificance} from './economic-significance';
import {assessCatalystEvidenceTimeline} from './catalyst-evidence-timeline';
import {createActionBrief,type ResearchAction} from './action-brief';
import {compareResearchTriage} from './research-triage-order';
import {readSavedPasses,type SavedPreliminaryPass} from './autonomous-pass-ledger';
import type {SecCompany,MarketValuationClose} from './ranking-model';

type Scan={rows:PickLead[];source:string;coverageStatus:string;lookbackCalendarDays:number;retrievedAt:string;errorDays:string[];truncated?:boolean;error?:string};
type News={title:string;source:string;link:string|null;feedPublishedAt:string|null;feedDateOnly:string|null};
type Evidence={review:FilingEvidenceResult|null;news:News[];newsIssue:string|null;reviewIssue:string|null;company:SecCompany|null;quote:MarketValuationClose|null;fundamentalIssue:string|null};
const KEY='atlas.monthly.sec-ledger.v1';
const REVIEW_CURSOR='atlas.home.sec-review-offset.v1';
const savedCursor=()=>{try{const n=Number(localStorage.getItem(REVIEW_CURSOR)||0);return Number.isSafeInteger(n)&&n>=0?n:0}catch{return 0}};
const easternDate=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return v.year+'-'+v.month+'-'+v.day};
function stored():PickLead[]{try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw) as PickLead[]:[]}catch{return []}}
export default function MonthlyPicksDashboard({onConviction,onOpportunity,heading='What deserves attention right now?',showScenarioActions=true}:{onConviction?:(ticker:string)=>void;onOpportunity?:()=>void;heading?:string;showScenarioActions?:boolean}){
 const [asOf]=useState(easternDate);
 const [leads,setLeads]=useState<PickLead[]>(()=>retainPickLeads(stored(),[],easternDate()));
 const [scan,setScan]=useState<Scan|null>(null);
 const [savedPasses,setSavedPasses]=useState<SavedPreliminaryPass[]>(()=>readSavedPasses(easternDate()));
 const [reviewProgress,setReviewProgress]=useState('');
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');
 const [evidence,setEvidence]=useState<Record<string,Evidence>>({});
 const [opened,setOpened]=useState<string|null>(null);
 const [period,setPeriod]=useState<'month'|'90d'>('month');
 const [generation,setGeneration]=useState(0);
 const [batchCursor,setBatchCursor]=useState(savedCursor);
 const [reviewBatch,setReviewBatch]=useState<PickLead[]>([]);
 const [reviewRange,setReviewRange]=useState({start:0,end:0,total:0});
 useEffect(()=>{
  let cancelled=false;
  const run=async()=>{
   setLoading(true);setMessage('');setEvidence({});setReviewBatch([]);setReviewProgress('');setSavedPasses(readSavedPasses(asOf));
   try{
    const response=await fetch('/api/opportunities/sec-wide');
    const data=await response.json() as Scan;
    if(!response.ok||!Array.isArray(data.rows))throw Error(data.error||'SEC discovery source unavailable');
    if(cancelled)return;
    const incoming=retainPickLeads(stored(),data.rows,asOf);
    setLeads(incoming);setScan(data);
    try{localStorage.setItem(KEY,JSON.stringify(incoming))}catch{/* Storage disabled: session remains useful */}
    // This bounded source review is intentionally NOT a market-wide 90-day
    // validated recommendation engine. SEC phrases and news headlines do not
    // establish an earnings surprise or the exact original news timestamp.
    const pool=thisMonth(incoming,asOf).length?thisMonth(incoming,asOf):incoming;
    const batch=selectIssuerReviewBatch(pool,batchCursor,8);
    const sample=batch.rows;
    setReviewBatch(sample);
    setReviewRange({start:batch.totalIssuers?batch.offset+1:0,end:batch.offset+sample.length,total:batch.totalIssuers});
    try{localStorage.setItem(REVIEW_CURSOR,String(batch.offset))}catch{/* No persistent cursor available */}
    let checked=0;
    for(const lead of sample){
     if(cancelled)break;
     let review:FilingEvidenceResult|null=null,news:News[]=[],reviewIssue:string|null=null,newsIssue:string|null=null;
     try{
      const r=await fetch('/api/opportunities/review?url='+encodeURIComponent(lead.url));
      review=await r.json() as FilingEvidenceResult;
      if(!r.ok||review.sourceStatus==='unavailable')reviewIssue=review.note||'SEC document review unavailable';
     }catch(e){reviewIssue=e instanceof Error?e.message:'SEC review unavailable'}
     const issuer=issuerSearchName(lead.name);
     if(lead.filed&&issuer)try{
      const n=await fetch('/api/catalyst/announcements?ticker='+encodeURIComponent(lead.ticker)+'&date='+lead.filed+'&company='+encodeURIComponent(issuer));
      const body=await n.json() as {candidates?:News[];error?:string};
      if(!n.ok)throw Error(body.error||'Public news search failed');
      news=(body.candidates||[]).filter(x=>x.link&&x.title&&headlineReferencesIssuer(x.title,lead.name)).slice(0,3);
     }catch(e){newsIssue=e instanceof Error?e.message:'News search unavailable'}
     if(!issuer)newsIssue='SEC issuer name could not be safely resolved for headline filtering; ticker-only news is withheld.';
     let company:SecCompany|null=null,quote:MarketValuationClose|null=null;
     const fundamentalProblems:string[]=[];
     const calls=await Promise.allSettled([
      fetch('/api/sec/company?ticker='+encodeURIComponent(lead.ticker)).then(async r=>{const body=await r.json() as SecCompany&{error?:string};if(!r.ok||body.ticker!==lead.ticker||!body.source?.startsWith('https://data.sec.gov/')||!Array.isArray(body.metrics))throw Error(body.error||'SEC annual issuer records unverified');return body}),
      fetch('/api/market/valuation-close?ticker='+encodeURIComponent(lead.ticker)).then(async r=>{const body=await r.json() as MarketValuationClose&{error?:string};if(!r.ok||body.ticker!==lead.ticker||body.feed!=='IEX'||!body.completedSession||!Number.isFinite(body.price)||body.price<=0)throw Error(body.error||'Completed close unverified');return body})
     ]);
     if(calls[0].status==='fulfilled')company=calls[0].value;
     else fundamentalProblems.push('SEC fundamentals: '+String(calls[0].reason));
     if(calls[1].status==='fulfilled')quote=calls[1].value;
     else fundamentalProblems.push('Market valuation: '+String(calls[1].reason));
     checked++;
     if(!cancelled){
      setReviewProgress('Reviewed '+checked+' of '+sample.length+' recent issuers across SEC text, issuer-news candidates, annual financials and IEX prices.');
      setEvidence(prev=>({...prev,[lead.url]:{review,news,reviewIssue,newsIssue,company,quote,fundamentalIssue:fundamentalProblems.join(' · ')||null}}));
     }
    }
   }catch(e){if(!cancelled)setMessage(e instanceof Error?e.message:'Could not retrieve SEC filings')}
   finally{if(!cancelled)setLoading(false)}
  };
  void run();
  return ()=>{cancelled=true};
 },[asOf,generation,batchCursor]);
 const monthly=thisMonth(leads,asOf);
 const visible=period==='month'?monthly:leads;
 const shortList=reviewBatch;
 const annotated=shortList.map(lead=>{
  const e=evidence[lead.url];
  const historicalPass=savedPasses.find(s=>s.ticker===lead.ticker)??null;
  const assessment=assessCatalystFundamentalBridge({ticker:lead.ticker,name:lead.name,filed:lead.filed,filingUrl:lead.url,
   review:e?.review??null,headlines:e?.news??[],company:e?.company??null,quote:e?.quote??null,asOf,autonomousPass:!!historicalPass});
  const economics=assessEconomicSignificance({ticker:lead.ticker,filingUrl:lead.url,review:e?.review??null,company:e?.company??null,asOf});
  const timeline=assessCatalystEvidenceTimeline({issuerName:lead.name,filingDate:lead.filed,asOf,review:e?.review??null,headlines:e?.news??[]});
  const brief=createActionBrief({bridge:assessment,economics,timeline,loaded:!!e,filed:lead.filed});
  return {lead,assessment,historicalPass,brief};
 }).sort((a,b)=>{
  const priority:Record<ResearchAction,number>={investigate:3,watch:2,checking:1,deprioritize:0};
  return priority[b.brief.action]-priority[a.brief.action]||compareResearchTriage(
   {assessment:a.assessment,historicalPass:!!a.historicalPass,filed:a.lead.filed,ticker:a.lead.ticker},
   {assessment:b.assessment,historicalPass:!!b.historicalPass,filed:b.lead.filed,ticker:b.lead.ticker}
  );
 });
 // The home shortlist is for research actions, not a random selection of
 // recently filed companies. Set-aside companies remain auditable below.
 const top=annotated.filter(x=>x.brief.action==='investigate'||x.brief.action==='watch').slice(0,3);
 const setAside=annotated.filter(x=>x.brief.action==='deprioritize');
 const alignedCount=annotated.filter(x=>x.assessment.status==='provisional_alignment').length;
 const investigateCount=annotated.filter(x=>x.brief.action==='investigate').length;
 const assessedCount=annotated.filter(x=>x.brief.action!=='checking').length;
 const sidebar=distinctIssuers(visible,6);
 return <section className="atlas-picks-workbench" aria-label="Recent SEC investment research leads">
  <div className="atlas-picks-header">
   <div><span className="eyebrow">RESEARCH BRIEF</span><h3>{heading}</h3>
    <p>Prioritized <strong>research actions</strong>, not buy recommendations. Expand a company to inspect the evidence and unresolved questions.</p></div>
   <button className="button secondary" type="button" onClick={()=>{if(scan&&reviewRange.total){setBatchCursor(x=>x+Math.max(1,reviewBatch.length))}else setGeneration(x=>x+1)}} disabled={loading}>{loading?'Checking sources…':scan&&reviewRange.total?'Review next issuer batch →':'Refresh current leads'}</button>
  </div>
  <div className="atlas-picks-grid">
   <div className="atlas-picks-main">
    {message&&<p className="real-error" role="alert">SEC discovery unavailable: {message}. Previously observed records remain labeled as historical observations.</p>}
    <div className="atlas-decision-strip" aria-label="ATLAS research decision summary">
     <strong>{loading?'ATLAS is reviewing this batch':'No verified bullish buy candidates in this batch'}</strong>
     <p>{assessedCount} of {reviewBatch.length} issuers assessed{reviewRange.total?' · queue positions '+reviewRange.start+'–'+reviewRange.end+' of '+reviewRange.total:''}. {investigateCount} candidate(s) worth deeper investigation; {alignedCount} preliminary filing/news/finance alignment(s). <strong>Neither is an investment recommendation.</strong></p>
     <p className="atlas-decision-next">Next: {investigateCount?'Open the investigation briefs and validate expectations, valuation and downside.':'Review another SEC batch or revisit these companies when material evidence changes.'}</p>
    </div>
    <details className="atlas-home-audit"><summary>Source coverage and screening audit</summary>
     <p>{scan?.coverageStatus??(loading?'SEC retrieval underway':'No fresh SEC run')} · recent index lookback approximately {scan?.lookbackCalendarDays??7} days{scan?.errorDays?.length?' · some index days failed':''}. No full three-month universe backfill.</p>
     <p>{reviewProgress||'Review underway.'} {savedPasses.length} saved preliminary Autonomous Discovery pass(es) in this browser. This queue advances through the available issuer rows, not through the entire listed market.</p>
    </details>
    {top.length===0?<p className="atlas-empty-brief">{loading?'ATLAS is reviewing SEC filings and company financials…':'No candidates in this batch currently merit a bullish follow-up. Try the next issuer batch or inspect the set-aside research below.'}</p>:
    <div className="atlas-picks-cards">{top.map(({lead,assessment,historicalPass,brief},i)=>{
     const e=evidence[lead.url],potential=e?.review?.evidence?.potential??[],cautions=e?.review?.evidence?.cautions??[];
     const filingTopics=e?.review?.evidence?.topics??[],reportedFigures=e?.review?.evidence?.metrics??[];
     return <article className="atlas-picks-card atlas-brief-card" key={lead.url}>
      <div className="atlas-picks-card-top">
       <div><span className="eyebrow">Research question {i+1} · {lead.filed??'filing date unavailable'}</span><h4>{lead.ticker} · {lead.name}</h4></div>
       <span className={'atlas-action-label atlas-action-'+brief.action}>{brief.action==='investigate'?'Investigate':brief.action==='watch'?'Watch':brief.action==='checking'?'Checking':'Deprioritize'}</span>
      </div>
      <h5 className="atlas-brief-headline">{brief.headline}</h5>
      <div className="atlas-brief-summary">
       <div><span>What ATLAS found</span><p>{brief.finding}</p></div>
       <div><span>What it means</span><p>{brief.interpretation}</p></div>
       <div><span>What changes this decision</span><p><strong>{brief.nextStep}</strong></p></div>
      </div>
      <p className="atlas-brief-provenance">{brief.evidenceNote} · <a href={lead.url} target="_blank" rel="noopener noreferrer">SEC filing ↗</a></p>
      <details className="atlas-brief-deep-dive">
       <summary>Show full evidence, news, valuation and source limitations</summary>
      <p><strong>{lead.form}</strong> filed {lead.filed??'date unavailable'}. Filing existence does not establish bullish direction, novelty, or remaining upside.</p>
      <p><a href={lead.url} target="_blank" rel="noopener noreferrer">Original SEC 8-K ↗</a></p>
      <section className="atlas-picks-evidence-bridge" aria-label={'Catalyst and fundamental cross-check for '+lead.ticker}>
       <strong>{assessment.status==='provisional_alignment'?'Provisional combined research candidate':assessment.status==='caution'?'Filing caution: no bullish promotion':'Not yet a cross-validated bullish candidate'}</strong>
       <div className="atlas-picks-bridge-metrics">
        <div><span>Annual SEC growth</span><strong>{assessment.screen?.growth===null||assessment.screen?.growth===undefined?'Unknown':assessment.screen.growth.toFixed(1)+'%'}</strong></div>
        <div><span>FCF margin</span><strong>{assessment.screen?.fcfMargin===null||assessment.screen?.fcfMargin===undefined?'Unknown':assessment.screen.fcfMargin.toFixed(1)+'%'}</strong></div>
        <div><span>Indicative FY P/E</span><strong>{assessment.fyPe===null?'Unknown':assessment.fyPe.toFixed(1)+'×'}</strong></div>
        <div><span>Fundamental priority</span><strong>{assessment.financialScore===null?'Unranked':assessment.financialScore+'/100'}</strong></div>
       </div>
       <p className="chart-note"><strong>8-K/news topic overlap:</strong> {assessment.topic?assessment.topic+' — headline match only, publisher/article still unverified':'Not established'}.
        <strong> SEC financial screen:</strong> {assessment.screen?.status.replaceAll('_',' ')??'not checked'}.
        {historicalPass&&<> <strong>Autonomous Discovery crossover:</strong> preliminary screen recorded {historicalPass.observedAt}, score {historicalPass.preliminaryScore}/100 (rechecked above against current sources).</>}
       </p>
       {e?.fundamentalIssue&&<p className="opportunity-uncertainty">Source limitations: {e.fundamentalIssue}</p>}
       <details className="atlas-details"><summary>Why ATLAS has not validated a buy case ({assessment.gaps.length} evidence limitation(s))</summary>
        <p>{assessment.interpretation}</p>
        {assessment.gaps.map((gap,j)=><p key={j}>· {gap}</p>)}
       </details>
      </section>
      {!e?<p className="chart-note">Checking filing text and news coverage…</p>:<>
       <p className="chart-note"><strong>SEC document review:</strong> {e.review?.sourceStatus==='reviewed_text'?'Complete source submission reviewed':e.review?.reviewMethod==='selected_documents'?'Selected SEC primary/exhibit documents reviewed — whole filing not verified':e.review?.sourceStatus==='partial_text'?'Truncated/partial submission text only':'Not available'} · {potential.length} potential-language matches · {cautions.length} caution-language matches. Neither count confirms a bullish event.</p>
       {filingTopics.length>0&&<p className="chart-note"><strong>SEC event subjects:</strong> {filingTopics.map(x=>'Item '+x.code+' · '+x.label).join('; ')}. Filing subjects are not an assessment of event direction.</p>}
       {reportedFigures.length>0&&<details className="atlas-details"><summary>Reported financial figures from selected SEC documents ({reportedFigures.length})</summary>{reportedFigures.slice(0,5).map((x,j)=><p key={j}><strong>{x.label}:</strong> {x.reportedValue}. {x.sourceUrl&&<a href={x.sourceUrl} target="_blank" rel="noopener noreferrer">Original passage ↗</a>}</p>)}</details>}
       {!potential.length&&<p className="chart-note">No recognized positive phrase was extracted from the reviewed text. This is <strong>not</strong> proof that the filing contained no significant catalyst.</p>}
       {e.reviewIssue&&<p className="opportunity-uncertainty">Filing access limit: {e.reviewIssue}</p>}
       {potential.slice(0,2).map((p,j)=><p className="chart-note" key={j}><strong>Possible filing development:</strong> {p.label} · <a href={p.sourceUrl||lead.url} target="_blank" rel="noopener noreferrer">SEC passage ↗</a></p>)}
       {cautions.slice(0,1).map((p,j)=><p className="opportunity-uncertainty" key={j}><strong>Filing caution:</strong> {p.label}</p>)}
       <div className="atlas-picks-news"><strong>Issuer-name matched news to verify (not corroborated)</strong>
        {e.news.length?e.news.map((n,j)=><p key={j}><a href={n.link!} target="_blank" rel="noopener noreferrer">{n.title}</a> · {n.source||'Publisher unverified'} · RSS {n.feedPublishedAt?.slice(0,10)||n.feedDateOnly||'date unknown'}</p>):
         <p className="chart-note">{e.newsIssue?'News feed unavailable: '+e.newsIssue:'No issuer-name-matched news headlines retrieved. Unrelated ticker/acronym matches are withheld.'}</p>}
       </div>
       <p className="chart-note">Displayed headlines must match this SEC issuer name, not merely its ticker. News is still a Google RSS discovery candidate: the publisher, substance and first-public time have not been independently reconciled with the 8-K. This lead is not a news-corroborated investment pick.</p>
       <EconomicSignificancePanel ticker={lead.ticker} filingUrl={lead.url} asOf={asOf} review={e.review} company={e.company}/>
       <CatalystVerificationPanel ticker={lead.ticker} issuerName={lead.name} filingDate={lead.filed} sourceUrl={lead.url} review={e.review} headlines={e.news} asOf={asOf}/>
      </>}
      </details>
      {(showScenarioActions||onConviction)&&<div className="atlas-picks-actions">
       {showScenarioActions&&<button type="button" className="button secondary" onClick={()=>setOpened(opened===lead.ticker?null:lead.ticker)} aria-expanded={opened===lead.ticker}>{opened===lead.ticker?'Close dollar scenarios':'Explore $500 dollar scenarios'}</button>}
       {onConviction&&<button type="button" className="button secondary" onClick={()=>onConviction(lead.ticker)}>Open Conviction Lab →</button>}
      </div>}
      {showScenarioActions&&opened===lead.ticker&&<InvestmentOutcomeSimulator key={lead.ticker} ticker={lead.ticker}/>}
     </article>})}</div>}
    {setAside.length>0&&<details className="atlas-home-audit atlas-setaside-list"><summary>Why {setAside.length} issuer(s) were set aside</summary>
     {setAside.map(x=><p key={x.lead.url}><strong>{x.lead.ticker}:</strong> {x.brief.headline}. {x.brief.interpretation} <a href={x.lead.url} target="_blank" rel="noopener noreferrer">SEC filing ↗</a></p>)}
    </details>}
    <details className="atlas-home-audit"><summary>How ATLAS orders this research queue</summary><p>ATLAS examines one batch of up to eight recent distinct SEC issuers. It first separates research actions (investigate, watch, or deprioritize), then considers provisional event alignment, SEC financial quality, valuation hurdles and incomplete evidence. This is <strong>not</strong> an all-market top-picks ranking or statistically validated alpha model. A low FY P/E is not a fair-value estimate; issuer headlines are not verified same-event corroboration. Zero buy candidates is an acceptable result.</p></details>
   </div>
   <aside className="atlas-picks-sidebar" aria-label="This month and last three months filing ledger">
    <h4>Recent SEC filings</h4>
    <div className="atlas-picks-switch" role="group" aria-label="Pick research time period">
     <button type="button" onClick={()=>setPeriod('month')} aria-pressed={period==='month'}>This month</button>
     <button type="button" onClick={()=>setPeriod('90d')} aria-pressed={period==='90d'}>Last 90 days</button>
    </div>
    <p className="chart-note">{visible.length} locally observed {period==='month'?'current-month':'90-day'} 8-K filing{visible.length===1?'':'s'} · not recommended picks.</p>
    {sidebar.map(x=><div className="atlas-picks-ledger-row" key={x.url}><strong>{x.ticker}</strong><span>{x.filed}</span><a href={x.url} target="_blank" rel="noopener noreferrer">SEC filing ↗</a></div>)}
    {!sidebar.length&&<p className="chart-note">No filings observed in this interval.</p>}
    <details className="atlas-home-audit"><summary>About filing history coverage</summary><p className="chart-note">This browser's ledger accumulates observed filings when ATLAS is opened or refreshed. <strong>It does not backfill a complete three-month SEC universe.</strong> Older dates and ticker coverage can be missing.</p></details>
    {onOpportunity&&<button className="button secondary" type="button" onClick={onOpportunity}>Open full SEC filing queue →</button>}
   </aside>
  </div>
 </section>;
}
