import {useEffect,useState,type FormEvent} from 'react';
import {validEvidenceUrl,type EvidenceRecord} from './breakthrough-model';
const STORAGE='atlas.breakthrough.v1';
const fields=['AI & computing','Energy','Biotechnology','Quantum & materials','Robotics','Other'];
function initial():EvidenceRecord[]{try{const value=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(value)?value.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'):[]}catch{return []}}
export default function BreakthroughResearch(){
 const [items,setItems]=useState<EvidenceRecord[]>(initial);
 const [title,setTitle]=useState('');const [sector,setSector]=useState(fields[0]);const [ticker,setTicker]=useState('');
 const [claim,setClaim]=useState('');const [url,setUrl]=useState('');const [date,setDate]=useState('');
 const [kind,setKind]=useState<EvidenceRecord['kind']>('Unverified hypothesis');
 const [error,setError]=useState('');
 useEffect(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(items))}catch{setError('Browser storage is unavailable. Your changes may not be saved.')}},[items]);
 function add(e:FormEvent){e.preventDefault();setError('');
  if(!title.trim()||!claim.trim())return setError('A technology and research observation are required.');
  if(url.trim()&&!validEvidenceUrl(url.trim()))return setError('Source must be an http:// or https:// URL.');
  if(kind!=='Unverified hypothesis'&&!url.trim())return setError('A source URL is required for evidence or milestones.');
  const record:EvidenceRecord={id:crypto.randomUUID(),title:title.trim(),sector,ticker:ticker.trim().toUpperCase(),claim:claim.trim(),url:url.trim(),date,kind,createdAt:new Date().toISOString()};
  setItems(v=>[record,...v]);setClaim('');setUrl('');setDate('');setKind('Unverified hypothesis');
 }
 return <section className="panel breakthrough">
  <div className="panel-head"><div><span className="eyebrow">ATLAS / EMERGING TECHNOLOGY INTELLIGENCE</span><h3>Breakthrough research log</h3></div><span className="tag">Research journal · not a prediction</span></div>
  <p className="description">Record emerging technologies, public-company exposure, and source-backed milestones. This is a manual evidence log: ATLAS has not verified or independently endorsed any entry. Hypotheses are not investment recommendations.</p>
  <form onSubmit={add} className="break-form">
   <label>Technology or company<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Photonic computing"/></label>
   <label>Technology area<select value={sector} onChange={e=>setSector(e.target.value)}>{fields.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Public ticker (optional)<input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} maxLength={12} pattern="[A-Za-z0-9.-]{0,12}" placeholder="Leave blank if private"/></label>
   <label>Evidence category<select value={kind} onChange={e=>setKind(e.target.value as EvidenceRecord['kind'])}><option>Unverified hypothesis</option><option>Technical evidence</option><option>Commercial milestone</option><option>Contradictory evidence</option></select></label>
   <label className="break-wide">Research observation<textarea required value={claim} onChange={e=>setClaim(e.target.value)} rows={3} maxLength={1800} placeholder="What happened? What would disprove the investment hypothesis?"/></label>
   <label className="break-wide">Source URL (required for evidence)<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label>
   <label>Source publication date (optional)<input type="date" max={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)}/></label>
   <div className="break-action"><button className="button primary" type="submit">Save research entry</button></div>
  </form>
  {error&&<p role="alert" className="real-error">{error}</p>}
  <div className="break-list-head"><h3>Research entries ({items.length})</h3><small>Stored in this browser only · clear browser data to delete</small></div>
  {!items.length?<div className="empty">No research entries yet. Start with a technology hypothesis and attach independent evidence as you investigate.</div>:<div className="break-grid">{items.map(x=><article className="break-entry" key={x.id}>
   <div className="break-entry-top"><strong>{x.title}</strong><span className="tag">{x.kind}</span></div>
   <small>{x.sector}{x.ticker?' · '+x.ticker:''} · Added {new Date(x.createdAt).toLocaleDateString()}</small>
   <p>{x.claim}</p>
   {x.url?<a href={x.url} rel="noopener noreferrer" target="_blank">Open user-provided source ↗</a>:<span className="muted">No source provided · unverified</span>}
   {x.date&&<small>Source dated {x.date}</small>}
   <button className="break-remove" type="button" aria-label={`Delete entry for ${x.title}`} onClick={()=>{if(window.confirm('Delete this research entry?'))setItems(v=>v.filter(y=>y.id!==x.id))}}>Delete entry</button>
  </article>)}</div>}
 </section>;
}
