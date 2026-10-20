import {ArrowRight,Search} from 'lucide-react';
import {readWorkspaceStorage,removeSavedCompany,selectComparison,WATCH_KEY as STORE,NOTES_KEY as NOTES,type CompanyEntry} from './watchlist-storage';
import SavedResearchContext from './SavedResearchContext';
import {readResearchContext} from './watchlist-research';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import CompanyComparison from './CompanyComparison';
import {deriveRankingMetrics,type SecCompany} from './ranking-model';
import {industryComparabilityLimitations} from './industry-classification';
import DiscoveryBriefingPanel from './DiscoveryBriefingPanel';
import './research-workspace.css';

type Research=SecCompany&{cik:string};
type Mode='research'|'watchlist';
const money=(n:number|null)=>n===null?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
const change=(n:number|null)=>n===null?'Unavailable':(n>0?'+':'')+n.toFixed(1)+'%';
const tone=(n:number|null)=>n===null||n===0?'atlas-tone-neutral':n>0?'atlas-tone-positive':'atlas-tone-negative';
const dateTime=(value:string)=>{
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'Unavailable':new Intl.DateTimeFormat('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'}).format(date);
};

export function createRequestSequence(){
 let latest=0;
 return {begin:()=>++latest,isCurrent:(request:number)=>request===latest,invalidate:()=>{latest++}};
}

export default function RealWorkspace({mode,defaultTicker='BLK',onView,onConviction}:{mode:Mode;defaultTicker?:string;onView?:(ticker:string)=>void;onConviction?:(ticker:string)=>void}){
 const [query,setQuery]=useState(mode==='watchlist'?'':defaultTicker);
 const [matches,setMatches]=useState<CompanyEntry[]>([]);
 const [selected,setSelected]=useState(defaultTicker);
 const [company,setCompany]=useState<Research|null>(null);
 const [busy,setBusy]=useState(false);
 const [searchBusy,setSearchBusy]=useState(false);
 const [error,setError]=useState('');
 const companyRequests=useRef(createRequestSequence());
 const queryEdits=useRef(0);
 const [savedData]=useState(()=>{try{return readWorkspaceStorage(localStorage)}catch{return {watch:[],notes:{},blocked:[STORE,NOTES],issues:['Browser storage unavailable. Saving is disabled.']}}});
 const [watch,setWatch]=useState<CompanyEntry[]>(savedData.watch);
 const [notes,setNotes]=useState<Record<string,string>>(savedData.notes);
 const [comparison,setComparison]=useState<string[]>([]);
 const [showComparison,setShowComparison]=useState(false);
 const [context]=useState(()=>{try{return readResearchContext(localStorage)}catch{return {summaries:[],theses:[],filings:[],issues:['Saved research is unavailable in this browser.']}}});
 function persist(key:string,value:unknown){if(savedData.blocked.includes(key)){setError('Existing saved data could not be read. It has not been overwritten.');return false}try{localStorage.setItem(key,JSON.stringify(value));return true}catch{setError('Browser storage unavailable. Changes have not been saved.');return false}}
 function editNote(ticker:string,value:string){const next={...notes,[ticker]:value};setNotes(next);persist(NOTES,next)}
 async function search(e:FormEvent){
  e.preventDefault();setError('');setMatches([]);setSearchBusy(true);
  try{
   const r=await fetch('/api/sec/search?q='+encodeURIComponent(query.trim()));
   const data=await r.json() as {items:CompanyEntry[];error?:string};
   if(!r.ok)throw Error(data.error||'Company search failed');
   setMatches(data.items);
   if(!data.items.length)setError('No matching SEC-listed companies found.');
  }catch(e){setError(e instanceof Error?e.message:'SEC ticker search unavailable')}
  finally{setSearchBusy(false)}
 }
 async function inspect(ticker:string){
  const request=companyRequests.current.begin();
  const queryEdit=queryEdits.current;
  setBusy(true);setError('');setSelected(ticker);setCompany(null);
  try{
   const r=await fetch('/api/sec/company?ticker='+encodeURIComponent(ticker));
   const data=await r.json() as Research&{error?:string};
   if(!companyRequests.current.isCurrent(request))return;
   if(!r.ok||!Array.isArray(data.metrics))throw Error(data.error||'Company financials unavailable');
   setCompany(data);
   if(queryEdits.current===queryEdit)setQuery(data.ticker);
  }catch(e){if(companyRequests.current.isCurrent(request))setError(e instanceof Error?e.message:'SEC data unavailable')}
  finally{if(companyRequests.current.isCurrent(request))setBusy(false)}
 }
 useEffect(()=>()=>companyRequests.current.invalidate(),[]);
 useEffect(()=>{if(mode==='research')void inspect(defaultTicker)},[mode,defaultTicker]);
 const saved=watch.some(w=>w.ticker===selected);
 function toggle(entry:CompanyEntry){const next=watch.some(w=>w.ticker===entry.ticker)?removeSavedCompany(watch,entry.ticker):[...watch,entry];if(persist(STORE,next)){setWatch(next);setComparison(old=>old.filter(ticker=>next.some(item=>item.ticker===ticker)));setShowComparison(false)}}
 function selectCompare(ticker:string){
  setShowComparison(false);
  setComparison(old=>selectComparison(old,ticker));
 }
 const fundamentals=company?deriveRankingMetrics(company):null;
 const limitations=company?industryComparabilityLimitations(company.classification):[];
 const isResearch=mode==='research';

 return <section className={isResearch?'atlas-research-workspace':'panel real-panel atlas-live-workspace'}>
  {isResearch?<>
   <header className="atlas-research-opening">
    <div className="atlas-research-proclamation">
     <span className="atlas-research-kicker">Company Research · SEC evidence</span>
     <h2>Does the investment evidence<br/><em>withstand investigation?</em></h2>
     <p>Start with the issuer, then separate reported fundamentals from derived measures, valuation gaps, and business-specific limitations.</p>
    </div>
    <form className="atlas-research-search" onSubmit={search} aria-label="Search SEC-listed companies">
     <label htmlFor="atlas-company-query">Company name or ticker</label>
     <div><Search size={19} aria-hidden="true"/><input id="atlas-company-query" aria-label="Search real company" value={query} onChange={e=>{queryEdits.current++;setQuery(e.target.value)}} maxLength={80} placeholder="CrowdStrike, BlackRock, NVDA…" required/><button type="submit" disabled={searchBusy}>{searchBusy?'Searching…':'Search SEC index'}</button></div>
     <small>Search resolves SEC issuer identity before financial evidence is requested.</small>
    </form>
   </header>
   <DiscoveryBriefingPanel variant="handoff" onSelect={ticker=>{queryEdits.current++;setQuery(ticker);void inspect(ticker)}}/>
  </>:<>
   <div className="panel-head"><div><span className="eyebrow">SAVED RESEARCH</span><h3>Saved companies ({watch.length})</h3></div><span className="tag">Browser only</span></div>
   <p className="description">Dated conclusions, thesis notes and previously observed filings. Saved locally; no background monitoring.</p>
   <DiscoveryBriefingPanel/>
   <form className="atlas-ranking-controls atlas-company-search" onSubmit={search}><label>Company name or ticker
    <input aria-label="Search real company" value={query} onChange={e=>{queryEdits.current++;setQuery(e.target.value)}} maxLength={80} placeholder="CrowdStrike, BlackRock, NVDA…" required/>
   </label><button className="button primary" type="submit" disabled={searchBusy}>{searchBusy?'Searching…':'Search companies'}</button></form>
  </>}

  {savedData.issues.map((issue,i)=><p className={isResearch?'atlas-research-alert':'real-error'} role="alert" key={i}>{issue}</p>)}
  {error&&<p className={isResearch?'atlas-research-alert':'real-error'} role="alert">{error}</p>}
  {searchBusy&&<p className={isResearch?'atlas-research-search-status':'chart-note'} role="status">Searching the SEC issuer index…</p>}

  {matches.length>0&&<section className={isResearch?'atlas-research-matches':'atlas-live-matches'} aria-label="Company search results">
   <strong>Company matches</strong>
   {matches.map(item=><div key={item.ticker}><span><strong>{item.ticker}</strong><small>{item.name}</small></span><div><button type="button" className={isResearch?'atlas-research-inline-action':'button secondary'} onClick={()=>{if(isResearch)void inspect(item.ticker);else onView?.(item.ticker)}}>Research</button><button type="button" className={isResearch?'atlas-research-inline-action atlas-research-inline-muted':'button'} onClick={()=>toggle(item)}>{watch.some(x=>x.ticker===item.ticker)?'Remove saved':'Save +'}</button></div></div>)}
  </section>}

  {isResearch&&<div className="atlas-research-investigation" aria-live="polite">
   {busy&&<section className="atlas-research-state" role="status"><span>Retrieving SEC evidence</span><strong>Building the company record…</strong><p>ATLAS is resolving annual Company Facts, source dates, and available classification metadata.</p></section>}
   {!busy&&!company&&!error&&<section className="atlas-research-state"><span>Investigation workspace</span><strong>Choose an SEC-listed company to begin.</strong><p>The workspace will preserve unavailable evidence instead of replacing it with estimates.</p></section>}
   {company&&<>
    <header className="atlas-research-company">
     <div><span>{company.ticker} · SEC issuer {company.cik}</span><h3>{company.name}</h3><p>Evidence retrieved {dateTime(company.retrievedAt)}. Financial statements may lag current market conditions.</p></div>
     <button type="button" onClick={()=>toggle({ticker:company.ticker,name:company.name})}>{saved?'Saved · remove':'Save to watchlist +'}</button>
    </header>

    <div className="atlas-research-flow">
     <main>
      <section className="atlas-research-section" aria-labelledby="reported-fundamentals">
       <div className="atlas-research-section-heading"><span>01</span><div><small>Reported fundamentals</small><h4 id="reported-fundamentals">What the annual filings support</h4></div></div>
       <dl className="atlas-research-metrics">
        <div><dt>Annual revenue</dt><dd>{money(fundamentals?.revenue??null)}</dd></div>
        <div><dt>Revenue growth</dt><dd className={tone(fundamentals?.growth??null)}>{change(fundamentals?.growth??null)}</dd></div>
        <div><dt>Derived free cash flow</dt><dd className={tone(fundamentals?.fcf??null)}>{money(fundamentals?.fcf??null)}</dd></div>
        <div><dt>FCF margin</dt><dd className={tone(fundamentals?.fcfMargin??null)}>{change(fundamentals?.fcfMargin??null)}</dd></div>
        <div><dt>Net margin</dt><dd className={tone(fundamentals?.profitMargin??null)}>{change(fundamentals?.profitMargin??null)}</dd></div>
       </dl>
       <p className="atlas-research-method"><strong>Fiscal year {fundamentals?.year??'unavailable'}.</strong> Free cash flow is derived from SEC-reported operating cash flow less capital expenditures. Nonstandard GAAP tags and missing periods remain unresolved rather than estimated.</p>
      </section>

      <section className="atlas-research-section" aria-labelledby="research-conclusion">
       <div className="atlas-research-section-heading"><span>05</span><div><small>Research conclusion</small><h4 id="research-conclusion">Record the case that would survive challenge</h4></div></div>
       <label className="atlas-research-note atlas-research-thesis"><strong>Your investment thesis · {company.ticker}</strong><span>State the growth case, central risk, and evidence that would change your mind.</span><textarea rows={5} disabled={savedData.blocked.includes(NOTES)} value={notes[company.ticker]||''} onChange={e=>editNote(company.ticker,e.target.value)} placeholder="Why might this grow? What could go wrong? What would change my mind?"/></label>
       {onConviction&&<button className="atlas-research-primary-action" type="button" onClick={()=>onConviction(company.ticker)}>Evaluate conviction <ArrowRight size={16}/></button>}
      </section>
     </main>

     <aside className="atlas-research-evidence-rail" aria-label="Valuation, limitations, and source evidence">
      <section><span>02 · Valuation boundary</span><h4>No valuation conclusion is produced here.</h4><p>The SEC Company Facts response does not include a verified current market price. Use valuation and conviction workflows before interpreting financial quality as opportunity.</p></section>
      <section><span>03 · Business-specific limitations</span><h4>{company.classification?.status==='reported'?`SEC SIC ${company.classification.code} · ${company.classification.description}`:'Industry classification unavailable'}</h4>{limitations.length?limitations.map((item,index)=><p key={index}>{item}</p>):<p>No specialized-financial warning applies from the reported SIC metadata. Company-specific comparability and accounting still require review.</p>}</section>
      <section><span>04 · Source evidence</span><h4>SEC Company Facts</h4><p>Retrieved {dateTime(company.retrievedAt)} for CIK {company.cik}. Open the primary dataset to verify tags, filing dates, periods, and units.</p><a href={company.source} target="_blank" rel="noopener noreferrer">Read SEC company financial facts <ArrowRight size={14}/></a></section>
     </aside>
    </div>
   </>}
  </div>}

  {mode==='watchlist'&&<div className="atlas-live-saved">
   {!watch.length&&<p><strong>Your watchlist is empty.</strong> Search for a company above to start building your research collection.</p>}
   {context.issues.map((issue,i)=><p role="status" key={i}>{issue}</p>)}
   <div className="watchlist-grid">{watch.map(entry=><article className="watchlist-card" key={entry.ticker}>
    <div className="atlas-ranking-row-head"><div><h3>{entry.ticker}</h3><p>{entry.name}</p></div><div><button className="button watchlist-remove" aria-label={`Remove ${entry.ticker} from watchlist`} type="button" onClick={()=>toggle(entry)}>Remove</button></div></div>
    <SavedResearchContext ticker={entry.ticker} context={context}/>
    <label className="atlas-research-note"><strong>Research note</strong><textarea rows={2} disabled={savedData.blocked.includes(NOTES)} value={notes[entry.ticker]||''} onChange={e=>editNote(entry.ticker,e.target.value)} placeholder="Write or update your thesis…"/></label>
    <div className="atlas-ranking-controls">
     <button className="button secondary" type="button" onClick={()=>onView?.(entry.ticker)}>Research company →</button>
     {onConviction&&<button className="button secondary" type="button" onClick={()=>onConviction(entry.ticker)}>Evaluate conviction →</button>}
     <button className="button secondary" type="button" aria-pressed={comparison.includes(entry.ticker)} onClick={()=>selectCompare(entry.ticker)}>{comparison.includes(entry.ticker)?'Selected ✓':'Select for comparison'}</button>
    </div>
   </article>)}</div>
   <div className="atlas-ranking-controls watchlist-comparison-bar"><strong>Compare {comparison.length}/2 selected companies</strong><button className="button primary" type="button" disabled={comparison.length!==2} onClick={()=>setShowComparison(true)}>Compare saved companies</button></div>
   {showComparison&&comparison.length===2&&<CompanyComparison key={comparison.join('-')} initialSymbols={[comparison[0],comparison[1]]}/>}
  </div>}
 </section>;
}
