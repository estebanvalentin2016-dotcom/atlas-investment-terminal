import {useState,type FormEvent} from 'react';
type Paper={doi:string;title:string;url:string;published:string|null;venue:string;type:string};
type Result={provider:string;query:string;retrievedAt:string;items:Paper[]};
export default function PublicationDiscovery(){
 const [query,setQuery]=useState('photonic computing');
 const [result,setResult]=useState<Result|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function search(e:FormEvent){e.preventDefault();setBusy(true);setError('');setResult(null);
  try{const response=await fetch('/api/discovery/publications?q='+encodeURIComponent(query.trim()));const body=await response.json() as Result&{error?:string};if(!response.ok)throw new Error(body.error||'Publication search failed');setResult(body)}
  catch(e){setError(e instanceof Error?e.message:'Publication search failed')}
  finally{setBusy(false)}
 }
 return <section className="panel discovery">
 <div className="panel-head"><div><span className="eyebrow">ATLAS / PUBLICATION DISCOVERY</span><h3>Explore new research publications</h3></div><span className="tag">Crossref · publication metadata</span></div>
 <p className="description">Search a live academic publication index for research leads. Results are publication metadata, not independently validated breakthroughs, company links, or investment signals. Search results may include unrelated papers and records with incomplete metadata.</p>
 <form onSubmit={search} className="discovery-form"><label htmlFor="discovery-q">Research topic</label><input id="discovery-q" minLength={3} maxLength={100} required value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. solid-state batteries"/><button type="submit" className="button primary" disabled={busy}>{busy?'Searching…':'Find publications'}</button></form>
 {error&&<div className="real-error" role="alert">{error} · No substitute results are shown.</div>}
 {result&&<><p className="chart-note">Source: {result.provider} · Query: {result.query} · Retrieved {new Date(result.retrievedAt).toLocaleString()} · {result.items.length} results. Sorted by publication date where available; this is not an importance ranking.</p>{!result.items.length?<div className="empty">No matching publication records found. Try a broader term.</div>:<div className="discovery-results">{result.items.map(p=><article key={p.doi} className="discovery-result"><strong>{p.title}</strong><small>{p.published||'Publication date unavailable'}{p.venue?' · '+p.venue:''} · {p.type}</small><a href={p.url} target="_blank" rel="noopener noreferrer">View publication / DOI ↗</a><small>DOI: {p.doi}</small></article>)}</div>}</>}
 </section>
}
