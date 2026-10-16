import {useEffect,useState} from 'react';
import InvestmentOutcomeSimulator from './InvestmentOutcomeSimulator';
import {distinctIssuers,retainPickLeads,thisMonth,type PickLead} from './picks-research';
import {headlineReferencesIssuer,issuerSearchName} from './issuer-news-identity';
import type {FilingEvidenceResult} from './FilingEvidence';

type Scan={rows:PickLead[];source:string;coverageStatus:string;lookbackCalendarDays:number;retrievedAt:string;errorDays:string[];truncated?:boolean;error?:string};
type News={title:string;source:string;link:string|null;feedPublishedAt:string|null;feedDateOnly:string|null};
type Evidence={review:FilingEvidenceResult|null;news:News[];newsIssue:string|null;reviewIssue:string|null};
const KEY='atlas.monthly.sec-ledger.v1';
const easternDate=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return v.year+'-'+v.month+'-'+v.day};
function stored():PickLead[]{try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw) as PickLead[]:[]}catch{return []}}
export default function MonthlyPicksDashboard({onConviction,onOpportunity}:{onConviction?:(ticker:string)=>void;onOpportunity?:()=>void}){
 const [asOf]=useState(easternDate);
 const [leads,setLeads]=useState<PickLead[]>(()=>retainPickLeads(stored(),[],easternDate()));
 const [scan,setScan]=useState<Scan|null>(null);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');
 const [evidence,setEvidence]=useState<Record<string,Evidence>>({});
 const [opened,setOpened]=useState<string|null>(null);
 const [period,setPeriod]=useState<'month'|'90d'>('month');
 const [generation,setGeneration]=useState(0);
 useEffect(()=>{
  let cancelled=false;
  const run=async()=>{
   setLoading(true);setMessage('');setEvidence({});
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
    const sample=distinctIssuers(thisMonth(incoming,asOf).length?thisMonth(incoming,asOf):incoming,3);
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
     if(!cancelled)setEvidence(prev=>({...prev,[lead.url]:{review,news,reviewIssue,newsIssue}}));
    }
   }catch(e){if(!cancelled)setMessage(e instanceof Error?e.message:'Could not retrieve SEC filings')}
   finally{if(!cancelled)setLoading(false)}
  };
  void run();
  return ()=>{cancelled=true};
 },[asOf,generation]);
 const monthly=thisMonth(leads,asOf);
 const visible=period==='month'?monthly:leads;
 const top=distinctIssuers(monthly.length?monthly:leads,3);
 const sidebar=distinctIssuers(visible,12);
 return <section className="atlas-picks-workbench" aria-label="Recent SEC investment research leads">
  <div className="atlas-picks-header">
   <div><span className="eyebrow">ATLAS / CURRENT CATALYST WATCH</span><h3>Today's research leads, not yet verified picks</h3>
    <p>Recent SEC 8-K disclosures, document review and related independent news candidates. Price-sensitive scenarios are available per company, but a defensible investment recommendation still requires corroboration and valuation.</p></div>
   <button className="button secondary" type="button" onClick={()=>setGeneration(x=>x+1)} disabled={loading}>{loading?'Checking sources…':'Refresh current leads'}</button>
  </div>
  <div className="atlas-picks-grid">
   <div className="atlas-picks-main">
    {message&&<p className="real-error" role="alert">SEC discovery unavailable: {message}. Previously observed records remain labeled as historical observations.</p>}
    <p className="chart-note"><strong>Coverage:</strong> {scan?.coverageStatus??(loading?'SEC source retrieval underway':'No fresh SEC run')} · live index search is limited to approximately {scan?.lookbackCalendarDays??7} days. {scan?.errorDays?.length?'Some index days failed; omissions are possible. ':''}No issuer is designated a Buy without source-confirmed news, comprehensive valuation and risk evidence.</p>
    {top.length===0?<p className="opportunity-uncertainty"><strong>No current source-backed shortlist loaded.</strong> ATLAS has not identified any investable picks yet. Review Opportunity Radar or refresh the SEC discovery feed.</p>:
    <div className="atlas-picks-cards">{top.map((lead,i)=>{
     const e=evidence[lead.url],potential=e?.review?.evidence?.potential??[],cautions=e?.review?.evidence?.cautions??[];
     return <article className="atlas-picks-card" key={lead.url}>
      <div className="atlas-picks-card-top"><div><span className="eyebrow">Research lead {i+1} · ranked by filing recency only</span><h4>{lead.ticker} · {lead.name}</h4></div><span className="tag">Not a buy rating</span></div>
      <p><strong>{lead.form}</strong> filed {lead.filed??'date unavailable'}. Filing existence does not establish bullish direction, novelty, or remaining upside.</p>
      <p><a href={lead.url} target="_blank" rel="noopener noreferrer">Original SEC 8-K ↗</a></p>
      {!e?<p className="chart-note">Checking filing text and news coverage…</p>:<>
       <p className="chart-note"><strong>SEC document review:</strong> {e.review?.sourceStatus==='reviewed_text'?'Selected text reviewed':e.review?.sourceStatus==='partial_text'?'Partial text only':'Not available'} · {potential.length} potential-language matches · {cautions.length} caution-language matches. Neither count confirms a bullish event.</p>
       {e.reviewIssue&&<p className="opportunity-uncertainty">Filing access limit: {e.reviewIssue}</p>}
       {potential.slice(0,2).map((p,j)=><p className="chart-note" key={j}><strong>Possible filing development:</strong> {p.label} · <a href={p.sourceUrl||lead.url} target="_blank" rel="noopener noreferrer">SEC passage ↗</a></p>)}
       {cautions.slice(0,1).map((p,j)=><p className="opportunity-uncertainty" key={j}><strong>Filing caution:</strong> {p.label}</p>)}
       <div className="atlas-picks-news"><strong>Issuer-name matched news to verify (not corroborated)</strong>
        {e.news.length?e.news.map((n,j)=><p key={j}><a href={n.link!} target="_blank" rel="noopener noreferrer">{n.title}</a> · {n.source||'Publisher unverified'} · RSS {n.feedPublishedAt?.slice(0,10)||n.feedDateOnly||'date unknown'}</p>):
         <p className="chart-note">{e.newsIssue?'News feed unavailable: '+e.newsIssue:'No issuer-name-matched news headlines retrieved. Unrelated ticker/acronym matches are withheld.'}</p>}
       </div>
       <p className="chart-note">Displayed headlines must match this SEC issuer name, not merely its ticker. News is still a Google RSS discovery candidate: the publisher, substance and first-public time have not been independently reconciled with the 8-K. This lead is not a news-corroborated investment pick.</p>
      </>}
      <div className="atlas-picks-actions">
       <button type="button" className="button secondary" onClick={()=>setOpened(opened===lead.ticker?null:lead.ticker)} aria-expanded={opened===lead.ticker}>{opened===lead.ticker?'Close dollar scenarios':'Explore $500 dollar scenarios'}</button>
       {onConviction&&<button type="button" className="button secondary" onClick={()=>onConviction(lead.ticker)}>Open Conviction Lab →</button>}
      </div>
      {opened===lead.ticker&&<InvestmentOutcomeSimulator key={lead.ticker} ticker={lead.ticker}/>}
     </article>})}</div>}
    <p className="chart-note"><strong>Ranking limitation:</strong> Listing the newest three distinct 8-K filers is *not* scoring the best securities, beating market consensus, or verifying that two sources describe the same material development. A source-gated investment-ranking engine remains to be built.</p>
   </div>
   <aside className="atlas-picks-sidebar" aria-label="This month and last three months filing ledger">
    <h4>Pick research ledger</h4>
    <div className="atlas-picks-switch" role="group" aria-label="Pick research time period">
     <button type="button" onClick={()=>setPeriod('month')} aria-pressed={period==='month'}>This month</button>
     <button type="button" onClick={()=>setPeriod('90d')} aria-pressed={period==='90d'}>Last 90 days</button>
    </div>
    <p className="chart-note">{visible.length} observed {period==='month'?'current-month':'90-day'} 8-K filing{visible.length===1?'':'s'} · not validated stock picks.</p>
    {sidebar.map(x=><div className="atlas-picks-ledger-row" key={x.url}><strong>{x.ticker}</strong><span>{x.filed}</span><a href={x.url} target="_blank" rel="noopener noreferrer">SEC filing ↗</a></div>)}
    {!sidebar.length&&<p className="chart-note">No filings observed in this interval.</p>}
    <p className="chart-note">This browser's ledger accumulates observed filings when ATLAS is opened or refreshed. <strong>It does not backfill a complete three-month SEC universe.</strong> Older dates and ticker coverage can be missing.</p>
    {onOpportunity&&<button className="button secondary" type="button" onClick={onOpportunity}>Open full SEC filing queue →</button>}
   </aside>
  </div>
 </section>;
}
