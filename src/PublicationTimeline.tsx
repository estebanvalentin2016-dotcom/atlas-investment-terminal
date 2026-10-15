import {useEffect,useState} from 'react';
// @ts-ignore JavaScript-only provenance check
import {assessPublication} from './publication-timeline.mjs';
export default function PublicationTimeline({session,secAcceptedAt,ticker}:{session:string;secAcceptedAt:string|null;ticker:string}){
 const [candidates,setCandidates]=useState<{title:string;link:string;source:string;feedPublishedAt:string|null;feedDateOnly?:string|null;feedDateRaw?:string;feedTimeSource?:string}[]>([]);
 const [newsState,setNewsState]=useState('Searching public news sources…');
 useEffect(()=>{
  let cancelled=false;
  setCandidates([]);setNewsState('Searching public news sources…');
  fetch('/api/catalyst/announcements?'+new URLSearchParams({ticker,date:session}))
   .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'News feed unavailable');return data})
   .then(data=>{if(!cancelled){setCandidates(data.candidates||[]);setNewsState(data.candidates?.length?'Potential announcements found — unverified matches':'No matching news candidates returned')}})
   .catch(e=>{if(!cancelled)setNewsState(e instanceof Error?e.message:'News source unavailable')});
  return ()=>{cancelled=true};
 },[ticker,session]);
 const [source,setSource]=useState(''),[published,setPublished]=useState(''),[note,setNote]=useState('');
 const [saved,setSaved]=useState<{source:string;published:string;note:string}|null>(null);
 const accepted=secAcceptedAt?new Date(secAcceptedAt).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'}):'Not provided';
 const results=assessPublication(saved?.published??'',session) as {time:string;status:string}[];
 const validSource=(()=>{try{const u=new URL(source);return u.protocol==='https:'&&Boolean(u.hostname)}catch{return false}})();
 const validTime=assessPublication(published,session).some((r:{status:string})=>r.status!=='Unknown');
 function record(){if(validSource&&validTime)setSaved({source,published,note})}
 return <section className="publication-timeline">
  <h4>Public announcement timing</h4>
  <p><strong>SEC acceptance (not public-release proof):</strong> {accepted}</p>
  <p className="publication-warning"><strong>Important: repeated 3 AM EDT readings can be Google News aggregation timestamps.</strong> They are NOT verified publisher posting times. ATLAS shows the source RSS clock separately and only treats a publisher's original date/time as confirmed after checking that publisher's page. Missing clock times remain unknown.</p>
  <div className="publication-candidates"><h5>Automatically discovered news</h5><p role="status">{newsState}</p>{candidates.map((c,i)=><div key={c.link+'-'+i}><a href={c.link} rel="noopener noreferrer" target="_blank">{c.title}</a><small><strong>{c.source||'Source not supplied'}</strong> · Google RSS clock: <strong>{c.feedPublishedAt?new Date(c.feedPublishedAt).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'}):c.feedDateOnly?'Date only '+c.feedDateOnly+' (time unknown)':'Unverified time'}</strong> · <strong>Not the publisher's verified posting time</strong> {c.feedDateRaw&&<span title="Original RSS pubDate">(raw feed: {c.feedDateRaw})</span>}</small></div>)}</div>
  <details className="publication-manual"><summary>Manual source correction / verification (optional)</summary><div className="publication-form">
   <label>Original public announcement URL (HTTPS)<input type="url" value={source} onChange={e=>{setSource(e.target.value);setSaved(null)}} placeholder="https://company.com/press-release" /></label>
   <label>Published date and time · Eastern<input type="datetime-local" value={published} onChange={e=>{setPublished(e.target.value);setSaved(null)}} /></label>
   <label>Source / timestamp notes (optional)<input value={note} onChange={e=>{setNote(e.target.value);setSaved(null)}} placeholder="Where the time is shown" /></label>
   <button type="button" className="button" disabled={!validSource||!validTime} onClick={record}>Apply reported publication time</button>
  </div>
  <p className="intraday-caveat">Use a timestamp explicitly shown by the original publisher. Feed timestamps and SEC acceptance do not prove this.</p></details>
  <div className="publication-checkpoints">{results.map(x=><div key={x.time}><strong>{x.time} ET</strong><span className={x.status.startsWith('Published')?'publication-possible':'publication-unknown'}>{x.status}</span></div>)}</div>
  {saved&&<p className="publication-source">User-reported publication time: <strong>{saved.published.replace('T',' ')} ET</strong>. <a href={saved.source} target="_blank" rel="noopener noreferrer">Examine original source ↗</a>{saved.note?' · '+saved.note:''}</p>}
  <p className="intraday-caveat">A prior publication timestamp only establishes chronological possibility; it does not establish when ATLAS could discover, evaluate or execute a trade. News candidate retrieval is automatic, but original publisher time verification, bullish classification and alerts are not implemented.</p>
 </section>;
}
