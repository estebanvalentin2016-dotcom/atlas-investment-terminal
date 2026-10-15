import {useState} from 'react';
type Annual = {year:number;end:string;filed:string;value:number;form:string;accession:string};
type Metric = {name:string;unit:string;values:Annual[];tag:string|null};
type Payload = {ticker:string;name:string;cik:string;source:string;retrievedAt:string;metrics:Metric[]};
const format = (n:number,unit:string) => unit==='USD' ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n) : n.toLocaleString('en-US');
export default function RealResearch(){
 const [ticker,setTicker]=useState('CRWD');
 const [data,setData]=useState<Payload|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 async function lookup(e:React.FormEvent){
  e.preventDefault();setLoading(true);setError('');setData(null);
  try{
   const response=await fetch('/api/sec/company?ticker='+encodeURIComponent(ticker.trim().toUpperCase()));
   const body=await response.json() as Payload&{error?:string};
   if(!response.ok)throw new Error(body.error||'SEC data unavailable');
   setData(body);
  }catch(e){setError(e instanceof Error?e.message:'Unable to retrieve SEC filings');}
  finally{setLoading(false)}
 }
 return <section className="panel real-panel">
  <div className="panel-head"><div><span className="eyebrow">PUBLIC COMPANY FILINGS / SEC EDGAR</span><h3>Real company financials</h3></div><span className="tag">SEC reported · no stock quotes</span></div>
  <p className="description">Research actual US public companies using reported annual financial data from SEC filings. These figures are separate from ATLAS's fictional demo screener and valuation lab.</p>
  <form className="real-search" onSubmit={lookup}><label htmlFor="real-ticker">Ticker</label><input id="real-ticker" value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} maxLength={12} placeholder="CRWD" pattern="[A-Za-z0-9.\-]{1,12}" required/><button className="button primary" disabled={loading} type="submit">{loading?'Loading SEC data…':'Fetch company filings'}</button></form>
  {error&&<div className="real-error" role="alert">{error}. No substitute or sample figures are being displayed.</div>}
  {data&&<div className="real-results">
   <div className="real-company"><strong>{data.name} ({data.ticker})</strong><span>CIK {data.cik} · Retrieved {new Date(data.retrievedAt).toLocaleString()}</span></div>
   <div className="real-grid">{data.metrics.map(m=><article className="real-metric" key={m.name}><span className="eyebrow">{m.name}</span>{m.values.length?<><strong>{format(m.values[0].value,m.unit)}</strong><small>Fiscal {m.values[0].year} · Period ended {m.values[0].end}</small><small>Filed {m.values[0].filed} · {m.values[0].form}</small><div className="real-history">{m.values.slice(1).map(v=><div key={v.year}><span>FY {v.year}</span><b>{format(v.value,m.unit)}</b></div>)}</div></>:<p>Not available in standardized annual SEC facts.</p>}</article>)}</div>
   <p className="chart-note">Source: <a href={data.source} target="_blank" rel="noreferrer">SEC EDGAR company facts</a>. Values come from filed annual reports and can be amended or restated. Fiscal periods, accounting tags, and comparability vary. No prices, P/E, opportunity score, or recommendations are inferred.</p>
  </div>}
  {!data&&!error&&!loading&&<p className="chart-note">Enter a real ticker and select “Fetch company filings.” Configuration requires a SEC contact identifier, described in README. Data is only requested when you press the button.</p>}
 </section>;
}
