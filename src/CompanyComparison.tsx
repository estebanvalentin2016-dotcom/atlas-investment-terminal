import {useState,type FormEvent} from 'react';
import {financialAnalysis,type FinancialMetric} from './financial-analysis';
type Company={ticker:string;name:string;source:string;retrievedAt:string;metrics:FinancialMetric[]};
const names=['Revenue','Net income','Operating cash flow','Total assets'];
const fmt=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
export function comparisonRows(a:Company,b:Company){
 const analysis=[financialAnalysis(a.metrics),financialAnalysis(b.metrics)];
 return [
 ...names.map(name=>({name,values:[a,b].map(c=>{const metric=c.metrics.find(m=>m.name===name);const x=metric?.values[0];return x?{display:fmt(x.value),end:x.end,filed:x.filed}:null})})),
 ...analysis[0].map((m,i)=>({name:m.label,values:analysis.map(ds=>ds[i].value===null?null:{display:ds[i].value!.toFixed(1)+'%',end:ds[i].detail,filed:null})}))
 ];
}
export default function CompanyComparison(){
 const [symbols,setSymbols]=useState(['CRWD','PANW']);
 const [companies,setCompanies]=useState<(Company|null)[]>([null,null]);
 const [errors,setErrors]=useState<string[]>(['','']);
 const [loading,setLoading]=useState(false);
 async function compare(e:FormEvent){
  e.preventDefault();setLoading(true);setCompanies([null,null]);setErrors(['','']);
  const outcomes=await Promise.all(symbols.map(async t=>{
   try{
    const response=await fetch('/api/sec/company?ticker='+encodeURIComponent(t.trim().toUpperCase()));
    const json=await response.json() as Company&{error?:string};
    if(!response.ok)throw new Error(json.error||'Data unavailable');
    return {data:json,error:''};
   }catch(e){return {data:null,error:e instanceof Error?e.message:'Request failed'};}
  }));
  setCompanies(outcomes.map(v=>v.data));setErrors(outcomes.map(v=>v.error));setLoading(false);
 }
 const both=companies[0]&&companies[1];
 return <section className="panel real-panel">
  <div className="panel-head"><div><span className="eyebrow">SEC EDGAR / COMPANY COMPARISON</span><h3>Compare two businesses</h3></div><span className="tag">Reported filings · no live prices</span></div>
  <p className="description">Compare actual reported annual financial figures and ATLAS-calculated growth metrics. Different fiscal year ends and accounting definitions may limit comparability.</p>
  <form className="compare-form" onSubmit={compare}>{symbols.map((symbol,i)=><label key={i}>Company {i+1}<input aria-label={`Company ${i+1} ticker`} value={symbol} pattern="[A-Za-z0-9.-]{1,12}" maxLength={12} required onChange={e=>setSymbols(v=>v.map((x,j)=>j===i?e.target.value.toUpperCase():x))}/></label>)}<button type="submit" className="button primary" disabled={loading}>{loading?'Fetching reports…':'Compare companies'}</button></form>
  {errors.map((error,i)=>error&&<p className="real-error" role="alert" key={i}>{symbols[i]}: {error}. Missing figures will not be replaced by estimates.</p>)}
  {companies.some(Boolean)&&<div className="compare-scroller"><table className="compare-table"><thead><tr><th>FINANCIAL MEASURE</th>{companies.map((c,i)=><th key={i}>{c?<><a href={c.source} target="_blank" rel="noreferrer">{c.name} ({c.ticker})</a><small>Retrieved {new Date(c.retrievedAt).toLocaleDateString()}</small></>:symbols[i]+' (unavailable)'}</th>)}</tr></thead><tbody>{(both?comparisonRows(companies[0]!,companies[1]!):names.map(name=>({name,values:companies.map(c=>{const v=c?.metrics.find(m=>m.name===name)?.values[0];return v?{display:fmt(v.value),end:v.end,filed:v.filed}:null})}))).map(row=><tr key={row.name}><td>{row.name}</td>{row.values.map((v,i)=><td key={i}>{v?<><strong>{v.display}</strong><small>{row.name.includes('growth')||row.name.includes('CAGR')||row.name.includes('margin')||row.name.includes('/ revenue')?v.end:'Fiscal period ended '+v.end}</small>{v.filed&&<small>Filed {v.filed}</small>}</>:<span className="muted">N/A</span>}</td>)}</tr>)}</tbody></table></div>}
  {companies.some(Boolean)&&<p className="chart-note">Source: each company's linked SEC company facts. Growth rates and margins are ATLAS calculations. Columns show each company's latest available annual period, which may differ between companies. This comparison is descriptive, not a ranking or recommendation. Operating cash flow is before capital expenditures.</p>}
 </section>;
}
