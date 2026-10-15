import {useEffect,useMemo,useState} from 'react';
import FilingEvidence,{type FilingEvidenceResult} from './FilingEvidence';
import FilingPriceContext from './FilingPriceContext';
import InvestmentRankings from './InvestmentRankings';
type Lead={ticker:string;name:string;form:string;filed:string|null;discoveredOn?:string;url:string;kind:string};
type IndexAudit={records:number;eightKRows:number;validEightKPaths:number;tickerMatchedEightK:number;undatedEightK:number;samples:{cik:string;form:string;filedRaw?:string;path:string;mappedTicker:string|null}[]};
type IndexDiagnostic={date:string;bytes:number;matched:number;status:number;contentType?:string;valid:boolean;encoding?:string;firstChars?:string;audit?:IndexAudit};
type FallbackDiagnostic={ticker:string;error?:string;latestFiling?:string|null;latest8K?:string|null;returnedRows?:number;matchingRecent8K?:number};
type ScanResponse={rows:Lead[];matchedFilings:number;returnedFilings?:number;truncated?:boolean;successfulDays:number;coverageStatus:string;source:string;fallbackChecked:number;fallbackFailed:number;diagnostics:IndexDiagnostic[];fallbackDiagnostics:FallbackDiagnostic[];errorDays:string[];retrievedAt:string;note:string;error?:string};
const PAGE_SIZE=20;
export default function OpportunityRadar(){
 const [result,setResult]=useState<ScanResponse|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [search,setSearch]=useState('');
 const [date,setDate]=useState('all');
 const [onePerCompany,setOnePerCompany]=useState(false);
 const [page,setPage]=useState(1);
 const [reviews,setReviews]=useState<Record<string,FilingEvidenceResult>>({});
 const [reviewing,setReviewing]=useState<string[]>([]);
 const [bulkReviewing,setBulkReviewing]=useState(false);
 async function reviewSource(url:string){
  setReviewing(prev=>[...prev,url]);
  try{
   const response=await fetch('/api/opportunities/review?url='+encodeURIComponent(url));
   const data=await response.json() as FilingEvidenceResult&{error?:string};
   if(!response.ok)throw Error(data.error||'SEC review request failed');
   setReviews(prev=>({...prev,[url]:data}));
  }catch(e){
   setReviews(prev=>({...prev,[url]:{url,sourceStatus:'unavailable',note:e instanceof Error?e.message:'Review failed'}}));
  }finally{setReviewing(prev=>prev.filter(x=>x!==url))}
 }

 async function scan(){
  setLoading(true);setError('');
  try{
   const response=await fetch('/api/opportunities/sec-wide');
   const data=await response.json() as ScanResponse;
   if(!response.ok)throw Error(data.error||'SEC filing discovery unavailable');
   if(!Array.isArray(data.rows))throw Error('SEC discovery returned an invalid filing queue');
   setResult(data);setPage(1);
  }catch(e){setResult(null);setError(e instanceof Error?e.message:'SEC discovery failed')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void scan()},[]);
 const availableDates=useMemo(()=>[...new Set((result?.rows||[]).map(r=>r.discoveredOn||r.filed).filter((d):d is string=>Boolean(d)))].sort().reverse(),[result]);
 const filtered=useMemo(()=>{
  const term=search.trim().toLowerCase();
  const candidates=(result?.rows||[]).filter(r=>(date==='all'||(r.discoveredOn||r.filed)===date)&&(!term||(r.ticker+' '+r.name).toLowerCase().includes(term)));
  if(!onePerCompany)return candidates;
  const seen=new Set<string>();
  return candidates.filter(r=>{const ticker=r.ticker.toUpperCase();if(seen.has(ticker))return false;seen.add(ticker);return true});
 },[result,search,date,onePerCompany]);
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const currentPage=Math.min(page,pages);
 const shown=filtered.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
 const resetFilters=()=>{setSearch('');setDate('all');setOnePerCompany(false);setPage(1)};
 async function reviewPageSample(){
  if(bulkReviewing)return;
  setBulkReviewing(true);
  try{
   // Bounded, sequential, on-demand review; this is NOT a ranked market scan.
   for(const lead of shown.slice(0,5)){
    if(!reviews[lead.url])await reviewSource(lead.url);
   }
  }finally{setBulkReviewing(false)}
 }

 return <section className="panel real-panel opportunity-radar">
  <div className="panel-head"><div><span className="eyebrow">ATLAS / OPPORTUNITY DISCOVERY</span><h3>SEC catalyst discovery</h3></div><span className="tag">Research leads · not buy signals</span></div>
  <p className="description"><strong>Find the filing. See the important numbers. Then check the stock.</strong> SEC filings are research leads — not automatic buy signals.</p>
  <div className="opportunity-toolbar"><strong>{loading?'Retrieving SEC filing indexes…':error?'Scan failed':result?'SEC index retrieval finished':'Waiting for scan'}</strong><button type="button" className="button" onClick={()=>void scan()} disabled={loading}>{loading?'Scanning…':'Refresh research queue'}</button></div>
  {result&&<div className="atlas-scan-grid" aria-label="SEC scan at a glance">
   <div><span>Filings found</span><strong>{result.rows.length.toLocaleString()}</strong><small>Not all are opportunities</small></div>
   <div><span>SEC index days accessible</span><strong>{result.successfulDays}</strong><small>Public filing sources</small></div>
   <div><span>Dates blocked</span><strong>{result.errorDays.length}</strong><small>Coverage is incomplete</small></div>
  </div>}
  {error&&<p className="real-error" role="alert">{error}</p>}
  {result&&result.errorDays.length>0&&<details className="opportunity-errors"><summary>Partial coverage: {result.errorDays.length} SEC retrieval issue(s)</summary>{result.errorDays.map(e=><p key={e}>{e}</p>)}</details>}
  {result&&<p className="atlas-summary-line"><strong>Coverage:</strong> {result.coverageStatus}. <strong>Blocked SEC dates are missing information</strong>, not proof of zero filings. {result.fallbackChecked>0&&('Fallback covered '+result.fallbackChecked+' companies, with '+result.fallbackFailed+' failures — not the entire market.')}</p>}
  {result&&<details className="opportunity-errors"><summary>Daily index diagnostics ({result.diagnostics?.length??0} requests)</summary>{result.diagnostics?.map(x=><div className="opportunity-diagnostic" key={x.date}><strong>{x.date}</strong>: HTTP {x.status} · {x.bytes.toLocaleString()} bytes · {x.contentType||'no content type'} · {x.encoding||'unknown encoding'} · {x.valid?'Valid SEC index':'No usable index'} · {x.matched} matched{x.audit&&<div className="chart-note">Index records: {x.audit.records} · Raw 8-K rows: {x.audit.eightKRows} · Valid 8-K paths: {x.audit.validEightKPaths} · Ticker matches: {x.audit.tickerMatchedEightK} · Unrecognized filing dates: {x.audit.undatedEightK}{x.audit.samples.map((sample,i)=><p key={i}>Sample {i+1}: CIK {sample.cik}, raw date {sample.filedRaw??'n/a'}, ticker {sample.mappedTicker||'unmapped'}, path {sample.path}</p>)}</div>}</div>)}</details>}
  {result&&result.fallbackChecked>0&&<details className="opportunity-errors"><summary>Company fallback audit ({result.fallbackChecked} companies)</summary>{result.fallbackDiagnostics?.map(x=><p key={x.ticker}><strong>{x.ticker}</strong>: {x.error||('latest filing '+(x.latestFiling||'unknown')+' · latest 8-K '+(x.latest8K||'none')+' · '+(x.matchingRecent8K??0)+' recent 8-Ks among '+(x.returnedRows??0)+' submissions')}</p>)}</details>}
  <details className="atlas-details atlas-ranking-entry" open><summary>Build a weighted investment research ranking · P/E · FCF · Growth <span className="atlas-ranking-chevron">↗</span></summary><InvestmentRankings/></details>
  {result&&<div className="opportunity-results">
   <div className="opportunity-results-head"><div><strong>Discovery review queue</strong><p>{filtered.length.toLocaleString()} filings match your filters · {result.rows.length.toLocaleString()} unique filings loaded{result.truncated?' · source list capped at 1,200':''}</p></div><span className="tag">Unassessed events</span></div>
   <div className="opportunity-filters">
    <label>Company or ticker <input type="search" placeholder="Search all loaded leads" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></label>
    <label>Index date <select value={date} onChange={e=>{setDate(e.target.value);setPage(1)}}><option value="all">All available dates</option>{availableDates.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
    <label className="opportunity-checkbox"><input type="checkbox" checked={onePerCompany} onChange={e=>{setOnePerCompany(e.target.checked);setPage(1)}}/> One filing per ticker</label>
    <button type="button" className="button secondary" onClick={resetFilters}>Clear filters</button>
   </div>
   <p className="chart-note"><strong>Newest filings first.</strong> Select a company to inspect actual evidence. The filing date does not tell us when the news first broke.</p>
   <div className="opportunity-toolbar"><strong>Source evidence review</strong><span>Review five visible SEC filings. This is a sample, <strong>not</strong> a ranking.</span><button type="button" className="button secondary" disabled={bulkReviewing||loading||!shown.length} onClick={()=>void reviewPageSample()}>{bulkReviewing?'Reviewing sample…':'Review first 5 visible'}</button></div>
   {shown.length>0?<div className="opportunity-list">{shown.map(r=><article className="opportunity-candidate" key={r.url}>
    <div className="opportunity-top"><strong>{r.ticker}</strong><span>{r.form} · Needs review</span></div>
    <h4>{r.name}</h4>
    <p>{r.discoveredOn?'Index day '+r.discoveredOn+' · Filing date '+(r.filed||'unverified'):'Filing date '+(r.filed||'unverified')+' · company submissions'}</p>
    <p className="opportunity-uncertainty"><strong>What we know:</strong> An SEC disclosure exists. <strong>What we don't know yet:</strong> Whether it's bullish, priced in, or available to trade.</p>
    <a href={r.url} target="_blank" rel="noopener noreferrer">Inspect SEC source ↗</a>
    <FilingEvidence data={reviews[r.url]} loading={reviewing.includes(r.url)} onReview={()=>void reviewSource(r.url)}/>
    <FilingPriceContext key={r.url} ticker={r.ticker} eventDate={r.filed} sourceUrl={r.url}/>
   </article>)}</div>:<p className="chart-note">No filings match these filters. Try clearing the search or changing the date.</p>}
   {filtered.length>PAGE_SIZE&&<div className="opportunity-pagination"><span>Showing {(currentPage-1)*PAGE_SIZE+1}–{Math.min(currentPage*PAGE_SIZE,filtered.length)} of {filtered.length}</span><button type="button" className="button secondary" disabled={currentPage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button><strong>Page {currentPage} / {pages}</strong><button type="button" className="button secondary" disabled={currentPage>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Next</button></div>}
  </div>}
  <p className="chart-note"><strong>Remember:</strong> Filings are leads, not recommendations. ATLAS cannot yet verify first-public news timing, an earnings surprise, or remaining upside. Refresh manually for new data.</p>
 </section>;
}
