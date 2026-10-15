import {useState,type FormEvent} from 'react';
type Bar={date:string;open:number;high:number;low:number;close:number;volume:number};
type Summary={date:string;close:number;volume:number;day1:number|null;day3:number|null;day5:number|null;rvol:number|null;below20DayHighPct:number|null};
type Response={ticker:string;provider:string;feed:string;adjustment:string;retrievedAt:string;bars:Bar[];summary:Summary|null;partialHistory:boolean;error?:string};
const pct=(n:number|null)=>n===null?'N/A':(n>=0?'+':'')+n.toFixed(2)+'%';
export default function MarketData(){
 const [ticker,setTicker]=useState('CRWD'),[data,setData]=useState<Response|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 async function load(e:FormEvent){e.preventDefault();setData(null);setError('');setLoading(true);
 try{const r=await fetch('/api/market/daily?ticker='+encodeURIComponent(ticker.trim().toUpperCase()));const j=await r.json() as Response;if(!r.ok)throw new Error(j.error||'Could not load prices');setData(j)}
 catch(e){setError(e instanceof Error?e.message:'Request failed')}finally{setLoading(false)}}
 return <section className="panel real-panel market-data">
 <div className="panel-head"><div><span className="eyebrow">ATLAS / PRICE FOLLOW-THROUGH</span><h3>Daily market momentum</h3></div><span className="tag">Alpaca IEX · not consolidated volume</span></div>
 <p className="description">Fetch actual daily bars from a configured free Alpaca account. Market data can be incomplete or unavailable. IEX volume is from one exchange, not total US market volume; scores and trading signals are intentionally omitted.</p>
 <form className="catalyst-form" onSubmit={load}><label>Ticker<input value={ticker} maxLength={12} pattern="[A-Za-z0-9.-]{1,12}" required onChange={e=>setTicker(e.target.value.toUpperCase())}/></label><button className="button primary" disabled={loading}>{loading?'Loading daily bars…':'Analyze daily momentum'}</button></form>
 {error&&<p role="alert" className="real-error">{error}</p>}
 {data&&<><p className="chart-note">{data.ticker} · Source: {data.provider} {data.feed} · Raw/unadjusted OHLCV · Retrieved {new Date(data.retrievedAt).toLocaleString()} · {data.bars.length} trading sessions {data.partialHistory?'· provider has additional paginated data':''}</p>
 {data.summary?<div className="real-insights">{[['1-day return',pct(data.summary.day1)],['3-day return',pct(data.summary.day3)],['5-day return',pct(data.summary.day5)],['Relative volume',data.summary.rvol===null?'N/A':data.summary.rvol.toFixed(2)+'×'],['Below 20-day high',pct(data.summary.below20DayHighPct)]].map(([label,val])=><article className="real-insight" key={label}><span className="eyebrow">{label}</span><strong>{val}</strong></article>)}</div>:<p className="chart-note">Insufficient valid daily bars for 20-session statistics.</p>}
 <p><a href={'https://finance.yahoo.com/quote/'+encodeURIComponent(data.ticker)+'/'} target="_blank" rel="noopener noreferrer">View {data.ticker} chart on Yahoo Finance ↗</a></p><div className="compare-scroller"><table className="compare-table"><thead><tr><th>Date</th><th>Close</th><th>Volume (IEX)</th></tr></thead><tbody>{data.bars.slice(-15).reverse().map(x=><tr key={x.date}><td>{x.date}</td><td>${x.close.toFixed(2)}</td><td>{x.volume.toLocaleString()}</td></tr>)}</tbody></table></div>
 <p className="chart-note">Measures use the latest returned session, which may be incomplete, not necessarily the last completed trading day. RVOL compares that session with the preceding 20 returned sessions; an incomplete session can severely distort it. Adjust for splits and dividends before evaluating longer price histories. This data is not automatically aligned with SEC catalysts and does not establish a trade entry.</p></>}
 </section>
}
