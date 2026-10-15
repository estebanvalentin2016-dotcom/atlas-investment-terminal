import {useState,type FormEvent} from 'react';
import {assessCandidate,parseWatchlist,type ScanRow,type DailySummary} from './scanner-model';
type ProviderResponse={ticker:string;summary:DailySummary|null;retrievedAt:string;feed:string;partialHistory:boolean;error?:string};
const format=(x:number|null,unit='%')=>x===null?'N/A':(x>=0&&unit==='%'?'+':'')+x.toFixed(2)+unit;
export default function MomentumScanner(){
 const [input,setInput]=useState('CRWD, NVDA, PANW, AMD, MSFT'),[rows,setRows]=useState<ScanRow[]>([]),[running,setRunning]=useState(false);
 const [checkedAt,setCheckedAt]=useState('');
 async function scan(e:FormEvent){e.preventDefault();const tickers=parseWatchlist(input);if(!tickers.length)return;
 setRunning(true);setRows([]);setCheckedAt('');
 const output:ScanRow[]=[];
 for(const ticker of tickers){
  try{const response=await fetch('/api/market/daily?ticker='+encodeURIComponent(ticker));const data=await response.json() as ProviderResponse;
   if(!response.ok)throw new Error(data.error||'Market data unavailable');
   output.push({ticker,summary:data.summary,retrievedAt:data.retrievedAt,feed:data.feed,partialHistory:data.partialHistory});
  }catch(err){output.push({ticker,summary:null,error:err instanceof Error?err.message:'Request failed'})}
  setRows([...output]);
 }
 setCheckedAt(new Date().toISOString());setRunning(false);
 }
 return <section className="panel real-panel scanner">
 <div className="panel-head"><div><span className="eyebrow">ATLAS / MULTI-STOCK RESEARCH</span><h3>Daily momentum watchlist scanner</h3></div><span className="tag">IEX only · research rules</span></div>
 <p className="description">Scan up to eight tickers with your configured free Alpaca market-data connection. Patterns use illustrative thresholds, not statistically validated trading signals. This screen does not yet connect price behavior to individual catalysts.</p>
 <form className="scanner-form" onSubmit={scan}><label>Tickers, separated by commas<input aria-label="Tickers to scan" value={input} maxLength={120} onChange={e=>setInput(e.target.value)} required/></label><button type="submit" className="button primary" disabled={running}>{running?'Scanning…':'Scan watchlist'}</button></form>
 <p className="chart-note">The scanner retrieves symbols sequentially to avoid bursts of requests. No unlimited market-wide scanning, background monitoring, or automatic trades. Each result uses the latest returned IEX daily session, which could be partial.</p>
 {(running||checkedAt)&&<p className="chart-note" role="status">{running?'Scanning '+rows.length+' of '+parseWatchlist(input).length+' tickers…':'Scan completed '+new Date(checkedAt).toLocaleString()}</p>}
 {rows.length>0&&<div className="scanner-results">{rows.map(r=>{const result=assessCandidate(r.summary);return <article className="scanner-card" key={r.ticker}><div className="scanner-heading"><strong>{r.ticker}</strong><span className="tag">{r.error?'Data unavailable':result.direction}</span></div>
  {r.error?<p className="real-error">{r.error}</p>:<><small>Latest session: {r.summary?.date||'N/A'} · {r.feed||'Unknown feed'}</small><div className="scanner-metrics"><span>1D <b>{format(r.summary?.day1??null)}</b></span><span>3D <b>{format(r.summary?.day3??null)}</b></span><span>5D <b>{format(r.summary?.day5??null)}</b></span><span>RVOL <b>{format(r.summary?.rvol??null,'×')}</b></span><span>From 20D high <b>{format(r.summary?.below20DayHighPct??null)}</b></span></div><small>{result.reasons.join(' · ')}</small><small>{r.partialHistory?'Provider indicated additional unrequested history · ':''}Retrieved {r.retrievedAt?new Date(r.retrievedAt).toLocaleString():'unknown'}</small></>}
  <a href={'https://finance.yahoo.com/quote/'+encodeURIComponent(r.ticker)+'/'} target="_blank" rel="noopener noreferrer">View on Yahoo Finance ↗</a>
 </article>})}</div>}
 <p className="chart-note">IEX price and volume can differ from consolidated US market activity. Results use raw unadjusted bars, may include partial daily sessions, and are not synchronized with SEC filing timestamps. Thresholds are screening heuristics, not return forecasts, trade recommendations, or validated signals.</p>
 </section>;
}
