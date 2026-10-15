import {useState,type FormEvent} from 'react';
import CompanyComparison from './CompanyComparison';
import {financialAnalysis,type FinancialMetric} from './financial-analysis';
type Annual = {year:number;end:string;filed:string;value:number;form:string;accession:string;tag?:string};
type Metric = FinancialMetric & {values:Annual[]};
type Payload = {ticker:string;name:string;cik:string;source:string;retrievedAt:string;metrics:Metric[]};
const format = (n:number,unit:string) => unit==='USD' ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n) : n.toLocaleString('en-US');
function Trend({metric}:{metric:Metric}){
 const points=[...metric.values].sort((a,b)=>a.year-b.year);
 if(points.length<2)return <p className="chart-note">At least two annual reports are required for a trend.</p>;
 const low=Math.min(0,...points.map(p=>p.value)), high=Math.max(...points.map(p=>p.value));
 const range=high-low||1, w=620,h=210,pad=30;
 const coords=points.map((v,i)=>({x:pad+i*(w-2*pad)/(points.length-1),y:h-pad-((v.value-low)/range)*(h-2*pad)}));
 return <div className="real-trend">
  <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Reported ${metric.name} by fiscal year`} preserveAspectRatio="xMidYMid meet">
   <line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="#62768c" strokeWidth="1"/>
   <polyline fill="none" stroke="#69baff" strokeWidth="3" strokeLinejoin="round" points={coords.map(c=>`${c.x},${c.y}`).join(' ')}/>
   {coords.map((c,i)=><g key={points[i].year}><circle cx={c.x} cy={c.y} r="5" fill="#69baff"/><text x={c.x} y={Math.max(15,c.y-13)} fill="#dceaf9" textAnchor="middle" fontSize="12">{format(points[i].value,'USD')}</text><text x={c.x} y={h-7} fill="#9eafc5" textAnchor="middle" fontSize="12">FY{points[i].year}</text></g>)}
  </svg>
 </div>
}
export default function RealResearch(){
 const [mode,setMode]=useState<'single'|'compare'>('single');
 const [ticker,setTicker]=useState('CRWD');
 const [data,setData]=useState<Payload|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [chart,setChart]=useState('Revenue');
 async function lookup(e:FormEvent){
  e.preventDefault();setLoading(true);setError('');setData(null);
  try{
   const response=await fetch('/api/sec/company?ticker='+encodeURIComponent(ticker.trim().toUpperCase()));
   const body=await response.json() as Payload&{error?:string};
   if(!response.ok)throw new Error(body.error||'SEC data unavailable');
   setData(body);setChart('Revenue');
  }catch(e){setError(e instanceof Error?e.message:'Unable to retrieve SEC filings');}
  finally{setLoading(false)}
 }
 const derived=data?financialAnalysis(data.metrics):[];
 const chosen=data?.metrics.find(m=>m.name===chart);
 return <><div className="real-mode"><button className={mode==='single'?'active':''} onClick={()=>setMode('single')}>Single company</button><button className={mode==='compare'?'active':''} onClick={()=>setMode('compare')}>Compare companies</button></div>{mode==='compare'?<CompanyComparison/>:<section className="panel real-panel">
  <div className="panel-head"><div><span className="eyebrow">PUBLIC COMPANY FILINGS / SEC EDGAR</span><h3>Real company financials</h3></div><span className="tag">SEC reported · no stock quotes</span></div>
  <p className="description">Research actual US public companies using reported annual financial data from SEC filings. These figures are separate from ATLAS's fictional demo screener and valuation lab.</p>
  <form className="real-search" onSubmit={lookup}><label htmlFor="real-ticker">Ticker</label><input id="real-ticker" value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} maxLength={12} placeholder="CRWD" pattern="[A-Za-z0-9.-]{1,12}" required/><button className="button primary" disabled={loading} type="submit">{loading?'Loading SEC data…':'Fetch company filings'}</button></form>
  {error&&<div className="real-error" role="alert">{error}. No substitute or sample figures are being displayed.</div>}
  {data&&<div className="real-results">
   <div className="real-company"><strong>{data.name} ({data.ticker})</strong><span>CIK {data.cik} · Retrieved {new Date(data.retrievedAt).toLocaleString()}</span></div>
   <div className="real-insights">{derived.map(d=><article className="real-insight" key={d.label}><span className="eyebrow">{d.label}</span><strong>{d.value===null?'N/A':`${d.value>=0?'+':''}${d.value.toFixed(1)}%`}</strong><small>{d.detail}</small></article>)}</div>
   <div className="real-chart-panel"><div className="real-chart-heading"><h3>Historical financial trends</h3><label>Metric <select value={chart} onChange={e=>setChart(e.target.value)}>{data.metrics.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select></label></div>{chosen&&<Trend metric={chosen}/>}<p className="chart-note">Annual reported values, not forecasts. Fiscal year ends vary between companies. Charts use the reported values shown below.</p></div>
   <div className="real-grid">{data.metrics.map(m=><article className="real-metric" key={m.name}><span className="eyebrow">{m.name}</span>{m.values.length?<><strong>{format(m.values[0].value,m.unit)}</strong><small>Fiscal {m.values[0].year} · Period ended {m.values[0].end}</small><small>Filed {m.values[0].filed} · {m.values[0].form}</small><div className="real-history">{m.values.slice(1).map(v=><div key={v.year}><span>FY {v.year}</span><b>{format(v.value,m.unit)}</b></div>)}</div></>:<p>Not available in standardized annual SEC facts.</p>}</article>)}</div>
   <p className="chart-note">Source: <a href={data.source} target="_blank" rel="noreferrer">SEC EDGAR company facts</a>. Growth rates and margins are ATLAS calculations, not values reported by the SEC. They use matched fiscal periods where possible. Historical financial results may be amended or restated. Operating cash flow excludes deductions for capital expenditure; it is not free cash flow. No prices or investment recommendations are inferred.</p>
  </div>}
  {!data&&!error&&!loading&&<p className="chart-note">Enter a real ticker and select “Fetch company filings.” Configuration requires a SEC contact identifier, described in README. Data is only requested when you press the button.</p>}
 </section>}</>;
}
