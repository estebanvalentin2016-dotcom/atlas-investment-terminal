import {readWorkspaceStorage,removeSavedCompany,selectComparison,WATCH_KEY as STORE,NOTES_KEY as NOTES,type CompanyEntry} from './watchlist-storage';
import SavedResearchContext from './SavedResearchContext';
import {readResearchContext} from './watchlist-research';
import {useEffect,useState,type FormEvent} from 'react';
import CompanyComparison from './CompanyComparison';
import {deriveRankingMetrics,type SecCompany} from './ranking-model';
import DiscoveryBriefingPanel from './DiscoveryBriefingPanel';

type Research=SecCompany&{cik:string};
type Mode='research'|'watchlist';
const money=(n:number|null)=>n===null?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
const change=(n:number|null)=>n===null?'N/A':(n>0?'+':'')+n.toFixed(1)+'%';
export default function RealWorkspace({mode,defaultTicker='BLK',onView,onConviction}:{mode:Mode;defaultTicker?:string;onView?:(ticker:string)=>void;onConviction?:(ticker:string)=>void}){
 const [query,setQuery]=useState(mode==='watchlist'?'':defaultTicker);
 const [matches,setMatches]=useState<CompanyEntry[]>([]);
 const [selected,setSelected]=useState(defaultTicker);
 const [company,setCompany]=useState<Research|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [savedData]=useState(()=>{try{return readWorkspaceStorage(localStorage)}catch{return {watch:[],notes:{},blocked:[STORE,NOTES],issues:['Browser storage unavailable. Saving is disabled.']}}});
 const [watch,setWatch]=useState<CompanyEntry[]>(savedData.watch);
 const [notes,setNotes]=useState<Record<string,string>>(savedData.notes);
 const [comparison,setComparison]=useState<string[]>([]);
 const [showComparison,setShowComparison]=useState(false);
 const [context]=useState(()=>{try{return readResearchContext(localStorage)}catch{return {summaries:[],theses:[],filings:[],issues:['Saved research is unavailable in this browser.']}}});
 function persist(key:string,value:unknown){if(savedData.blocked.includes(key)){setError('Existing saved data could not be read. It has not been overwritten.');return false}try{localStorage.setItem(key,JSON.stringify(value));return true}catch{setError('Browser storage unavailable. Changes have not been saved.');return false}}
 function editNote(ticker:string,value:string){const next={...notes,[ticker]:value};setNotes(next);persist(NOTES,next)}
 async function search(e:FormEvent){
  e.preventDefault();setError('');setMatches([]);
  try{
   const r=await fetch('/api/sec/search?q='+encodeURIComponent(query.trim()));
   const data=await r.json() as {items:CompanyEntry[];error?:string};
   if(!r.ok)throw Error(data.error||'Company search failed');
   setMatches(data.items);
   if(!data.items.length)setError('No matching SEC-listed companies found.');
  }catch(e){setError(e instanceof Error?e.message:'SEC ticker search unavailable')}
 }
 async function inspect(ticker:string){
  setBusy(true);setError('');setSelected(ticker);setCompany(null);
  try{
   const r=await fetch('/api/sec/company?ticker='+encodeURIComponent(ticker));
   const data=await r.json() as Research&{error?:string};
   if(!r.ok||!Array.isArray(data.metrics))throw Error(data.error||'Company financials unavailable');
   setCompany(data);setQuery(data.ticker);
  }catch(e){setError(e instanceof Error?e.message:'SEC data unavailable')}
  finally{setBusy(false)}
 }
 useEffect(()=>{if(mode==='research')void inspect(defaultTicker)},[mode,defaultTicker]);
 const saved=watch.some(w=>w.ticker===selected);
 function toggle(entry:CompanyEntry){const next=watch.some(w=>w.ticker===entry.ticker)?removeSavedCompany(watch,entry.ticker):[...watch,entry];if(persist(STORE,next)){setWatch(next);setComparison(old=>old.filter(ticker=>next.some(item=>item.ticker===ticker)));setShowComparison(false)}}
 function selectCompare(ticker:string){
  setShowComparison(false);
  setComparison(old=>selectComparison(old,ticker));
 }
 const fundamentals=company?deriveRankingMetrics(company):null;
 return <section className="panel real-panel atlas-live-workspace">
  <div className="panel-head"><div><span className="eyebrow">{mode==='watchlist'?'SAVED RESEARCH':'SEC COMPANY ANALYSIS'}</span><h3>{mode==='watchlist'?'Saved companies ('+watch.length+')':'Search and investigate any SEC-listed company'}</h3></div><span className="tag">{mode==='watchlist'?'Browser only':'Real SEC facts · not sample companies'}</span></div>
  <p className="description">{mode==='watchlist'?'Dated conclusions, thesis notes and previously observed filings. Saved locally; no background monitoring.':'Search a company to examine reported financials and develop a thesis. Missing values remain unavailable.'}</p>

  <DiscoveryBriefingPanel/>
  <form className="atlas-ranking-controls atlas-company-search" onSubmit={search}><label>Company name or ticker
   <input aria-label="Search real company" value={query} onChange={e=>setQuery(e.target.value)} maxLength={80} placeholder="CrowdStrike, BlackRock, NVDA…" required/>
  </label><button className="button primary" type="submit">Search companies</button></form>
  {savedData.issues.map((issue,i)=><p className="real-error" role="alert" key={i}>{issue}</p>)}
  {error&&<p className="real-error" role="alert">{error}</p>}
  {matches.length>0&&<div className="atlas-live-matches"><strong>Company matches</strong>{matches.map(item=><div key={item.ticker}><span><strong>{item.ticker}</strong> · {item.name}</span><button className="button secondary" type="button" onClick={()=>{if(mode==='research')void inspect(item.ticker);else onView?.(item.ticker)}}>Research</button><button className="button" type="button" onClick={()=>toggle(item)}>{watch.some(x=>x.ticker===item.ticker)?'Remove saved':'Save +'}</button></div>)}</div>}
  {mode==='research'&&<div className="atlas-live-details">
   {busy&&<p role="status"><strong>Fetching real SEC statements…</strong></p>}
   {company&&<><div className="atlas-ranking-row-head"><div><strong>{company.ticker}</strong><p>{company.name}</p></div><button className="button primary" type="button" onClick={()=>toggle({ticker:company.ticker,name:company.name})}>{saved?'Saved ✓ · Remove':'Save to watchlist +'}</button></div>
    <div className="atlas-ranking-metrics">
     <div><span>Revenue growth</span><strong className={fundamentals?.growth!=null?(fundamentals.growth>=0?'atlas-tone-positive':'atlas-tone-negative'):''}>{change(fundamentals?.growth??null)}</strong></div>
     <div><span>Free cash flow</span><strong>{money(fundamentals?.fcf??null)}</strong></div>
     <div><span>FCF margin</span><strong>{change(fundamentals?.fcfMargin??null)}</strong></div>
     <div><span>Net margin</span><strong>{change(fundamentals?.profitMargin??null)}</strong></div>
    </div>
    <p className="chart-note"><strong>Fiscal year {fundamentals?.year??'unavailable'}.</strong> Financial statements may lag current prices. Some companies have nonstandard GAAP tags; missing values remain N/A.</p>
    <label className="atlas-research-note"><strong>Your investment thesis · {company.ticker}</strong><textarea rows={4} disabled={savedData.blocked.includes(NOTES)} value={notes[company.ticker]||''} onChange={e=>editNote(company.ticker,e.target.value)} placeholder="Why might this grow? What could go wrong? What would change my mind?"/></label>
    {onConviction&&<button className="button secondary" type="button" onClick={()=>onConviction(company.ticker)}>Evaluate conviction →</button>}
    <a href={company.source} target="_blank" rel="noopener noreferrer">Read SEC company financial facts ↗</a>
   </>}
  </div>}
  {mode==='watchlist'&&<div className="atlas-live-saved">
   {!watch.length&&<p><strong>No real companies saved yet.</strong> Search above to create your list.</p>}
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
