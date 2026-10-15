import {useState} from 'react';
// @ts-ignore JavaScript-only provenance check
import {assessPublication} from './publication-timeline.mjs';
const checkpoints=['09:45','10:00','10:30'];
export default function PublicationTimeline({session,secAcceptedAt}:{session:string;secAcceptedAt:string|null}){
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
  <p className="publication-warning">ATLAS has not independently confirmed when this news first became public. The publication evidence below is entered by you and must be verified against the linked original announcement.</p>
  <div className="publication-form">
   <label>Original public announcement URL (HTTPS)<input type="url" value={source} onChange={e=>{setSource(e.target.value);setSaved(null)}} placeholder="https://company.com/press-release" /></label>
   <label>Published date and time · Eastern<input type="datetime-local" value={published} onChange={e=>{setPublished(e.target.value);setSaved(null)}} /></label>
   <label>Source / timestamp notes (optional)<input value={note} onChange={e=>{setNote(e.target.value);setSaved(null)}} placeholder="Where the time is shown" /></label>
   <button type="button" className="button" disabled={!validSource||!validTime} onClick={record}>Apply reported publication time</button>
  </div>
  <p className="intraday-caveat">Use the timestamp explicitly displayed by the publisher, not the time you found the article. Do not enter the SEC acceptance time unless a separate primary source establishes it as the public release time.</p>
  <div className="publication-checkpoints">{results.map(x=><div key={x.time}><strong>{x.time} ET</strong><span className={x.status.startsWith('Published')?'publication-possible':'publication-unknown'}>{x.status}</span></div>)}</div>
  {saved&&<p className="publication-source">User-reported publication time: <strong>{saved.published.replace('T',' ')} ET</strong>. <a href={saved.source} target="_blank" rel="noopener noreferrer">Examine original source ↗</a>{saved.note?' · '+saved.note:''}</p>}
  <p className="intraday-caveat">A prior publication timestamp only establishes chronological possibility; it does not establish when ATLAS could discover, evaluate or execute a trade. No automated verification, bullish classification or alert is implemented.</p>
 </section>;
}
