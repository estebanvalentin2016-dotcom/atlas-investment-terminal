import {useState} from 'react';
import {annualPeFromSec,defaultRankWeights,rankCompanies,type AnnualPe,type MarketValuationClose,type SecCompany} from './ranking-model';
import {initialAutonomousScreen,scanCounts,type ScreenResult} from './autonomous-screen';
type Listed={ticker:string;name:string;cik:number};
type UniversePage={total:number;start:number;nextCursor:number;completedCycle:boolean;rows:Listed[];indexUrl:string;retrievedAt:string;error?:string;seedTickersUsed:boolean;scope:string};
type Candidate={company:SecCompany;screen:ScreenResult;valuation:AnnualPe|null;quote:MarketValuationClose|null;priceIssue:string|null};
const BATCH=24,CURSOR_KEY='atlas.autonomous.sec.cursor.v1';
const initialCursor=()=>{try{const n=Number(localStorage.getItem(CURSOR_KEY)||0);return Number.isSafeInteger(n)&&n>=0?n:0}catch{return 0}};
const money=(n:number|null)=>n===null?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
const pct=(n:number|null)=>n===null?'N/A':(n>=0?'+':'')+n.toFixed(1)+'%';
const easternDate=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const x=Object.fromEntries(p.filter(k=>k.type!=='literal').map(k=>[k.type,k.value]));return x.year+'-'+x.month+'-'+x.day};
export default function AutonomousDiscovery({onResearch,onConviction}:{onResearch?:(ticker:string)=>void;onConviction?:(ticker:string)=>void}){
 const [cursor,setCursor]=useState(initialCursor);
 const [universe,setUniverse]=useState<UniversePage|null>(null);
 const [screened,setScreened]=useState<ScreenResult[]>([]);
 const [failed,setFailed]=useState<{ticker:string;reason:string}[]>([]);
 const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [progress,setProgress]=useState('');
 const [done,setDone]=useState(false);
 const [quotesChecked,setQuotesChecked]=useState(0);
 async function discover(){
  if(busy)return;
  setBusy(true);setDone(false);setUniverse(null);setScreened([]);setCandidates([]);setFailed([]);setError('');setQuotesChecked(0);
  setProgress('Enumerating actual companies from the SEC ticker index…');
  try{
   const r=await fetch('/api/autonomous/universe?cursor='+cursor+'&limit='+BATCH);
   const page=await r.json() as UniversePage;
   if(!r.ok||!Array.isArray(page.rows)||!page.indexUrl?.startsWith('https://www.sec.gov/'))throw Error(page.error||'Cannot enumerate the public SEC company universe');
   setUniverse(page);
   const today=easternDate(),records:{company:SecCompany;screen:ScreenResult}[]=[],sourceIssues:{ticker:string;reason:string}[]=[];
   // Two concurrent SEC company-facts requests maximum. The existing server cache
   // and SEC_USER_AGENT remain authoritative; no bypass of SEC source controls.
   let finished=0;
   for(let i=0;i<page.rows.length;i+=2){
    const group=page.rows.slice(i,i+2);
    await Promise.all(group.map(async ({ticker})=>{
     try{
      const response=await fetch('/api/sec/company?ticker='+encodeURIComponent(ticker));
      const company=await response.json() as SecCompany&{error?:string};
      if(!response.ok||!company.source?.startsWith('https://data.sec.gov/')||company.ticker!==ticker||!Array.isArray(company.metrics))throw Error(company.error||'SEC annual source incomplete');
      const screen=initialAutonomousScreen(company,today);
      records.push({company,screen});
     }catch(e){sourceIssues.push({ticker,reason:e instanceof Error?e.message:'SEC company facts unavailable'})}
     finished++;
     setProgress('Checking SEC annual fundamentals: '+finished+' / '+page.rows.length+' issuer records…');
    }));
   }
   const passes=records.filter(x=>x.screen.status==='preliminary_pass')
    .sort((a,b)=>(b.screen.score??-1)-(a.screen.score??-1)||a.company.ticker.localeCompare(b.company.ticker));
   setScreened(records.map(x=>x.screen));setFailed(sourceIssues);
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
    research.push({...row,quote,valuation,priceIssue});
    setQuotesChecked(i+1);
   }
   const valuationMap=Object.fromEntries(research.map(x=>[x.company.ticker,x.valuation?.pe??null]));
   const sorted=rankCompanies(research.map(x=>x.company),defaultRankWeights,valuationMap);
   research.sort((a,b)=>sorted.findIndex(x=>x.ticker===a.company.ticker)-sorted.findIndex(x=>x.ticker===b.company.ticker));
   setCandidates(research);
   setProgress('Completed this SEC-index batch. Ranked research leads are preliminary, not investment recommendations.');
   setDone(true);
   setCursor(page.nextCursor);
   try{localStorage.setItem(CURSOR_KEY,String(page.nextCursor))}catch{}
  }catch(e){
   setError(e instanceof Error?e.message:'Autonomous scan unavailable');
   setProgress('Scan failed. No companies were silently substituted.');
  }finally{setBusy(false)}
 }
 const summary=scanCounts(screened,failed.length,universe?.rows.length??0);
 return <section className="panel real-panel atlas-autonomous-discovery">
  <div className="panel-head"><div><span className="eyebrow">ATLAS / AUTONOMOUS INVESTMENT DISCOVERY</span><h3>Discover companies without entering a ticker</h3></div><span className="tag">Real SEC universe · Initial research stage</span></div>
  <p className="description"><strong>ATLAS chooses the companies to examine.</strong> Each scan draws the next batch from the public SEC company index, checks actual annual financials and investigates the leading preliminary matches. No favorite ticker list drives discovery.</p>
  <button type="button" className="button primary atlas-autonomous-cta" onClick={()=>void discover()} disabled={busy}>{busy?'Discovering real companies…':done?'Discover more companies →':'Discover Opportunities →'}</button>
  <p className="chart-note"><strong>Current scope:</strong> One bounded batch of up to {BATCH} SEC-indexed tickers at a time; the cursor advances across the complete retrieved index on successive scans. SEC ticker inclusion alone does not verify exchange, current listing, sector, market cap or liquidity. This is not yet a whole-universe, complete investment-selection run.</p>
  {progress&&<p className="atlas-summary-line" role="status">{progress}</p>}
  {error&&<p className="opportunity-uncertainty" role="alert"><strong>Scan unavailable:</strong> {error}</p>}
  {universe&&<div className="atlas-autonomous-results">
   <div className="atlas-autonomous-metrics">
    <div><span>SEC ticker universe</span><strong>{universe.total.toLocaleString()}</strong><small>Index entries, not screened companies</small></div>
    <div><span>This batch enumerated</span><strong>{summary.enumerated}</strong><small>Index offsets {universe.start}–{universe.start+universe.rows.length-1}</small></div>
    <div><span>SEC financials checked</span><strong>{summary.financialRecordsChecked}</strong><small>{summary.sourceFailures} source failure(s)</small></div>
    <div><span>Preliminary passes</span><strong>{summary.preliminary}</strong><small>Not confirmed bargains</small></div>
   </div>
   <p className="chart-note"><strong>Universe index:</strong> <a href={universe.indexUrl} target="_blank" rel="noopener noreferrer">SEC company ticker file ↗</a> · fetched {new Date(universe.retrievedAt).toLocaleString('en-US')}. {universe.scope}</p>
   {done&&<div className="atlas-autonomous-funnel">
    <strong>Screening audit · this batch only</strong>
    <p><strong>{summary.enumerated}</strong> enumerated → <strong>{summary.financialRecordsChecked}</strong> annual SEC records checked → <strong>{summary.preliminary}</strong> preliminary financial passes → <strong>{quotesChecked}</strong> completed-price lookups attempted → <strong>0</strong> fully verified high-conviction investments.</p>
    <p className="chart-note">Other financial-screen outcomes: {summary.failed} below provisional thresholds, {summary.incomplete} missing required accounting values, {summary.stale} stale annual financials, {summary.sourceFailures} blocked/failed SEC sources. Up to eight preliminarily eligible companies receive price follow-up.</p>
   </div>}
   {done&&<div className="atlas-autonomous-leads">
    <h4>Research priorities from this independently discovered batch</h4>
    {!candidates.length&&<p className="opportunity-uncertainty"><strong>No candidates passed this batch's initial financial screen.</strong> ATLAS will not manufacture a result. Select “Discover more companies” to examine the next index batch.</p>}
    {candidates.map((item,i)=><article className="atlas-autonomous-lead" key={item.company.ticker}>
     <div className="atlas-autonomous-heading"><div><small>Research candidate {i+1} · not a buy rating</small><strong>{item.company.ticker} · {item.company.name}</strong></div><span>INSUFFICIENT EVIDENCE</span></div>
     <div className="atlas-key-return">
      <div><span className="atlas-glance-label">Reported annual revenue growth</span><strong className={'atlas-glance-value '+(item.screen.growth!==null&&item.screen.growth>=0?'atlas-tone-positive':'atlas-tone-negative')}>{pct(item.screen.growth)}</strong></div>
      <div><span className="atlas-glance-label">Free cash flow margin</span><strong className="atlas-glance-value">{pct(item.screen.fcfMargin)}</strong></div>
      <div><span className="atlas-glance-label">Indicative FY P/E</span><strong className="atlas-glance-value">{item.valuation?.pe==null?'N/A':item.valuation.pe.toFixed(1)+'×'}</strong></div>
      <div><span className="atlas-glance-label">Latest completed IEX close</span><strong className="atlas-glance-value">{money(item.quote?.price??null)}</strong><small>{item.quote?.sessionDate??'Price unavailable'}</small></div>
     </div>
     <p className="chart-note"><strong>FY filing:</strong> {item.screen.filed??'Unknown'}. <strong>Reason surfaced:</strong> {item.screen.reasons.join('; ')}. {item.priceIssue||item.valuation?.reason||'Price-sensitive earnings valuation incomplete.'}</p>
     <p className="opportunity-uncertainty"><strong>Still not validated:</strong> market cap, exchange, liquidity, dilution, debt/runway, sector durability, institutional consensus, original news timing and 5-year valuation scenarios. These are NOT investment recommendations.</p>
     <div className="atlas-ranking-controls"><a href={item.company.source} target="_blank" rel="noopener noreferrer">Inspect original SEC financial data ↗</a>{onResearch&&<button className="button secondary" type="button" onClick={()=>onResearch(item.company.ticker)}>Research company →</button>}{onConviction&&<button className="button secondary" type="button" onClick={()=>onConviction(item.company.ticker)}>Check conviction gates →</button>}</div>
    </article>)}
   </div>}
   {done&&failed.length>0&&<details className="atlas-details"><summary>Source failures ({failed.length})</summary>{failed.map((x,i)=><p key={x.ticker+'-'+i}><strong>{x.ticker}:</strong> {x.reason}</p>)}</details>}
   {done&&<details className="atlas-details"><summary>Every issuer scanned and why it passed or failed</summary>{universe.rows.map(row=>{const match=screened.find(s=>s.ticker===row.ticker),issue=failed.find(f=>f.ticker===row.ticker);return <p key={row.cik}><strong>{row.ticker} · {row.name}</strong> — {match?match.status.replaceAll('_',' ')+(match.reasons.length?' ('+match.reasons.join('; ')+')':''):issue?'SEC source unavailable: '+issue.reason:'Not examined'} · CIK {row.cik}</p>})}</details>}
  </div>}
 </section>;
}
