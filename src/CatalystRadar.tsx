import {useState,type FormEvent} from 'react';
import {assessMomentum} from './momentum-model';
import EventReaction from './EventReaction';
// @ts-ignore JavaScript-only event study helper.
import {formatSecAcceptedEastern} from './event-study.mjs';
type Filing={form:string;date:string;acceptedAt:string|null;items:string;labels:string[];url:string;accession:string};
type Response={ticker:string;name:string;retrievedAt:string;filings:Filing[];error?:string};
export default function CatalystRadar(){
 const [ticker,setTicker]=useState('CRWD');const [data,setData]=useState<Response|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [values,setValues]=useState({priorClose:'',latestClose:'',priorVolume:'',averageVolume:''});
 async function lookup(e:FormEvent){e.preventDefault();setBusy(true);setError('');setData(null);
  try{const r=await fetch('/api/catalyst/sec?ticker='+encodeURIComponent(ticker.trim().toUpperCase()));const body=await r.json() as Response;if(!r.ok)throw new Error(body.error||'SEC feed unavailable');setData(body)}
  catch(e){setError(e instanceof Error?e.message:'Could not retrieve filings')}finally{setBusy(false)}
 }
 const hasAll=Object.values(values).every(v=>v.trim().length>0);
 const stats=hasAll?assessMomentum({priorClose:Number(values.priorClose),latestClose:Number(values.latestClose),priorVolume:Number(values.priorVolume),averageVolume:Number(values.averageVolume)}):null;
 return <section className="panel real-panel">
  <div className="panel-head"><div><span className="eyebrow">ATLAS / CATALYST-TO-MOMENTUM</span><h3>SEC catalyst monitor</h3></div><span className="tag">Research preview · no trade signals</span></div>
  <p className="description">Review recent 8-K disclosures that may warrant further research. Event labels are classified from SEC item numbers only; they do not establish whether a filing is bullish or bearish. SEC data is requested on demand, not pushed as instant news.</p>
  <form className="catalyst-form" onSubmit={lookup}><label>Public ticker<input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} maxLength={12} pattern="[A-Za-z0-9.-]{1,12}" required/></label><button type="submit" className="button primary" disabled={busy}>{busy?'Checking SEC…':'Find recent 8-K filings'}</button></form>
  {error&&<p className="real-error" role="alert">{error}. No example events have been substituted.</p>}
  {data&&<><p className="chart-note">{data.name} ({data.ticker}) · SEC retrieval {new Date(data.retrievedAt).toLocaleString()}. SEC acceptance times (when supplied) are not necessarily public announcement times.</p>{!data.filings.length?<p>No recent 8-K filings in the available submission history.</p>:data.filings.map(f=><article className="catalyst-entry" key={f.accession}><strong>{f.form} · {f.labels.join(' / ')}</strong><small>Filed {f.date} · SEC accepted: {formatSecAcceptedEastern(f.acceptedAt)} · Item codes: {f.items||'not supplied'} · Accession {f.accession}</small><a href={f.url} target="_blank" rel="noreferrer">Read original SEC filing ↗</a><EventReaction ticker={data.ticker} acceptedAt={f.acceptedAt}/></article>)}</>}
  <div className="real-chart-panel"><h3>Momentum measurement worksheet</h3><p className="chart-note">Enter observed prices and volumes from your own market-data source. Values below are user supplied, not independently verified or fetched. This worksheet does not generate buy/sell signals.</p>
   <div className="momentum-fields">{([['priorClose','Earlier closing price'],['latestClose','Later closing price'],['priorVolume','Observed session volume'],['averageVolume','Comparable average session volume']] as const).map(([key,label])=><label key={key}>{label}<input aria-label={label} type="number" step="any" min="0.0000001" value={values[key]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))} placeholder="Enter value"/></label>)}</div>
   {hasAll&&(stats?<p><strong>Price change: {stats.returnPct.toFixed(2)}% · Relative volume: {stats.relativeVolume.toFixed(2)}×</strong></p>:<p className="real-error" role="alert">Enter strictly positive, finite prices and volumes.</p>)}
   <p className="catalyst-note">Relative volume here compares a whole trading session with an equivalent average whole session, not same-time-of-day volume. Different measurement periods or adjusted prices make comparisons misleading. No trade recommendation is implied.</p>
  </div>
 </section>;
}
