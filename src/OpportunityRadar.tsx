import {useEffect,useState} from 'react';
type Lead={ticker:string;name:string;form:string;filed:string;url:string;kind:string};
type Response={rows:Lead[];matchedFilings:number;successfulDays:number;coverageStatus:string;fallbackChecked:number;fallbackFailed:number;diagnostics:{date:string;bytes:number;matched:number}[];errorDays:string[];retrievedAt:string;scope:string;note:string;error?:string};
export default function OpportunityRadar(){
 const [result,setResult]=useState<Response|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 async function scan(){
  setLoading(true);setError('');
  try{
   const r=await fetch('/api/opportunities/sec-wide');
   const data=await r.json() as Response;
   if(!r.ok)throw Error(data.error||'Market-wide SEC feed unavailable');
   setResult(data);
  }catch(e){setResult(null);setError(e instanceof Error?e.message:'SEC-wide discovery failed')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void scan()},[]);
 return <section className="panel real-panel opportunity-radar">
  <div className="panel-head"><div><span className="eyebrow">ATLAS / OPPORTUNITY DISCOVERY</span><h3>Market-wide SEC catalyst feed</h3></div><span className="tag">Fresh filing leads · not buy signals</span></div>
  <p className="description">Automatically discover recent 8-K disclosures across companies in the SEC ticker index. Scans the previous seven calendar days of SEC daily filing indexes, not just eight hand-picked companies. These are event leads; the filings have not yet been evaluated for bullish fundamentals or remaining upside.</p>
  <div className="opportunity-toolbar"><strong>{loading?'Retrieving SEC filing indexes…':error?'Scan failed':result?'SEC index retrieval finished':'Waiting for scan'}</strong>{result&&<span>{result.matchedFilings} 8-K filing leads · {result.successfulDays} daily indexes retrieved{result.fallbackChecked>0?' · limited company fallback':''}</span>}<button type="button" className="button" onClick={()=>void scan()} disabled={loading}>{loading?'Scanning…':'Refresh research queue'}</button></div>
  {error&&<p className="real-error" role="alert">{error}</p>}
  {result&&result.errorDays.length>0&&<details className="opportunity-errors"><summary>Partial coverage: {result.errorDays.length} SEC retrieval issue(s)</summary>{result.errorDays.map(e=><p key={e}>{e}</p>)}</details>}
  {result&&<p className="chart-note">Source coverage: <strong>{result.coverageStatus}</strong>. SEC 403 means access is restricted, not zero filings. {result.fallbackChecked>0&&('Fallback: '+result.fallbackChecked+' companies checked; '+result.fallbackFailed+' failed. This is NOT market-wide coverage.')}</p>}
  {result&&<details className="opportunity-errors"><summary>Source diagnostics ({result.diagnostics?.length??0} parsed index files)</summary>{result.diagnostics?.map(x=><p key={x.date}>{x.date}: {x.bytes.toLocaleString()} characters · {x.matched} ticker-matched filings</p>)}</details>}
  {result&&result.rows.length>0&&<div className="opportunity-list">{result.rows.map(r=><article className="opportunity-candidate" key={r.url}>
   <div className="opportunity-top"><strong>{r.ticker}</strong><span>{r.form} · Awaiting substance review</span></div>
   <h4>{r.name}</h4>
   <p>Filed {r.filed} · Indexed 8-K disclosure</p>
   <p className="opportunity-uncertainty">Bullish catalyst: <strong>Unverified</strong> · Remaining upside: <strong>Unknown</strong> · Entry viability: <strong>Unknown</strong></p>
   <a href={r.url} target="_blank" rel="noopener noreferrer">Read indexed SEC filing ↗</a>
  </article>)}</div>}
  {result&&!result.rows.length&&<p className="chart-note">No matching filings found in the SEC indexes successfully retrieved. When coverage is partial, this cannot be interpreted as a market-wide no-opportunity result.</p>}
  <p className="chart-note">Displays up to 40 newest matching filings, sorted by filing date—not by forecast profit. Excludes non-indexed tickers, non-8-K documents and sources the SEC does not provide through daily indexes. Daily filings do not contain reliable announcement minutes. There is no live-price check, profitability assessment, background monitoring or Robinhood execution verification in this phase.</p>
 </section>;
}
