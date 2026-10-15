import {useEffect,useState} from 'react';
// @ts-ignore JavaScript-only transparent research triage.
import {STARTER_UNIVERSE,triageFilings} from './opportunity-triage.mjs';
type Filing={acceptedAt:string|null;items:string;accession:string;url:string};
type SecResult={ticker:string;name:string;filings:Filing[]};
type Candidate={ticker:string;name:string;acceptedAt:string;accession:string;url:string;kind:string;daysOld:number};
export default function OpportunityRadar(){
 const [rows,setRows]=useState<Candidate[]>([]);
 const [scanned,setScanned]=useState(0);
 const [errors,setErrors]=useState<string[]>([]);
 const [loading,setLoading]=useState(false);
 const [completed,setCompleted]=useState(false);
 const [started,setStarted]=useState(false);
 async function scan(){
  setStarted(true);setLoading(true);setCompleted(false);setScanned(0);setRows([]);setErrors([]);
  const fetched:SecResult[]=[];const failures:string[]=[];
  // Sequential requests keep traffic modest under SEC rate limits.
  for(const ticker of STARTER_UNIVERSE as string[]){
   try{
    const r=await fetch('/api/catalyst/sec?ticker='+encodeURIComponent(ticker));
    const data=await r.json() as SecResult&{error?:string};
    if(!r.ok)throw Error(data.error||'Source unavailable');
    fetched.push(data);
   }catch(e){failures.push(ticker+': '+(e instanceof Error?e.message:'Request failed'))}
   setScanned(fetched.length+failures.length);
   setRows(triageFilings(fetched) as Candidate[]);
   setErrors([...failures]);
  }
  setCompleted(true);setLoading(false);
 }
 useEffect(()=>{void scan()},[]);
 return <section className="panel real-panel opportunity-radar">
  <div className="panel-head"><div><span className="eyebrow">ATLAS / OPPORTUNITY DISCOVERY</span><h3>Automatic catalyst queue</h3></div><span className="tag">SEC evidence · not buy signals</span></div>
  <p className="description">ATLAS automatically checks eight publicly traded companies for SEC earnings disclosures and material agreements from the past 14 days. Recent earnings appear first for review. Filing categories are NOT evidence of positive earnings, attractive valuation or remaining upside.</p>
  <div className="opportunity-toolbar"><strong>{loading?'Scanning public filings…':completed?'Scan complete':started?'Starting scan…':'Preparing scan'}</strong><span>{scanned} / {STARTER_UNIVERSE.length} companies checked</span><button type="button" className="button" onClick={()=>void scan()} disabled={loading}>{loading?'Scanning…':'Refresh research queue'}</button></div>
  {errors.length>0&&<details className="opportunity-errors"><summary>{errors.length} source error(s) — affected tickers were excluded</summary>{errors.map(e=><p key={e}>{e}</p>)}</details>}
  {rows.length>0?<div className="opportunity-list">{rows.map(r=><article className="opportunity-candidate" key={r.ticker+r.accession}>
   <div className="opportunity-top"><strong>{r.ticker}</strong><span>{r.kind}</span></div>
   <h4>{r.name}</h4>
   <p>SEC accepted {new Date(r.acceptedAt).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'})} · {r.daysOld.toFixed(1)} days ago</p>
   <p className="opportunity-uncertainty">Bullishness: <strong>Not assessed</strong> · Remaining upside: <strong>Unknown</strong> · Robinhood entry: <strong>Unverified</strong></p>
   <a href={r.url} target="_blank" rel="noopener noreferrer">Inspect original SEC filing ↗</a>
  </article>)}</div>:<p className="chart-note">{completed?'No qualifying recent filings in the checked universe. This is not evidence that no opportunities exist.':'Results will appear as sources respond.'}</p>}
  <p className="chart-note">Discovery universe is a starter set, not the whole market. Results are SEC filing events, not assessed bullish opportunities. The scan runs when you open this screen and on manual refresh; it does not run when ATLAS is closed. No prices, news sentiment, execution checks or real-time alerts are incorporated in this first queue.</p>
 </section>;
}
