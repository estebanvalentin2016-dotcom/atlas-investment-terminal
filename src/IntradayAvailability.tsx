import {useState} from 'react';
// @ts-ignore JavaScript research helper
import {entryWindows} from './entry-windows.mjs';
type Probe={bars:{timeEt:string;open:number;high:number;low:number;close:number}[];barCount:number;firstBarTimeEt:string|null;lastBarTimeEt:string|null;fullRegularSession:boolean;partialHistory:boolean;feed:string;timeframe:string;error?:string};
export default function IntradayAvailability({ticker,session}:{ticker:string;session:string}){
 const [info,setInfo]=useState<Probe|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 async function check(){
  setLoading(true);setInfo(null);setError('');
  try{
   const q=new URLSearchParams({ticker,session});
   const res=await fetch('/api/market/intraday-availability?'+q);
   const body=await res.json() as Probe;
   if(!res.ok)throw Error(body.error||'Intraday data unavailable');
   setInfo(body);
  }catch(e){setError(e instanceof Error?e.message:'Intraday availability check failed')}
  finally{setLoading(false)}
 }
 const windows=info?entryWindows(info.bars,info.fullRegularSession,info.partialHistory) as {time:string;reference:number|null;toClose:number|null;highest:number|null;lowest:number|null}[]:[];
 const fmt=(n:number|null)=>n===null?'N/A':(n>=0?'+':'')+n.toFixed(2)+'%';
 const klass=(n:number|null)=>n===null?'entry-neutral':n>0?'entry-positive':n<0?'entry-negative':'entry-neutral';
 return <section className="event-intraday-check">
  <strong>Intraday feasibility · 15-minute IEX bars</strong>
  <p>Check whether the free data source has regular-session historical bars for {session}. This only checks coverage; it does not calculate hypothetical entry returns or prove an executable trade.</p>
  <button type="button" className="button" onClick={check} disabled={loading}>{loading?'Checking coverage…':'Check 15-minute data availability'}</button>
  {error&&<p className="real-error" role="alert">{error}</p>}
  {info&&<div className="intraday-results" role="status">
   <div className="intraday-results-heading"><strong>Historical intraday coverage</strong><span className={info.fullRegularSession&&!info.partialHistory?'intraday-status-complete':'intraday-status-partial'}>{info.fullRegularSession&&!info.partialHistory?'All expected intervals':'Incomplete coverage'}</span></div>
   <div className="intraday-metrics"><div><span>15-minute bars</span><strong>{info.barCount}<small> / 26</small></strong></div><div><span>First bar · ET</span><strong>{info.firstBarTimeEt??'N/A'}</strong></div><div><span>Last bar · ET</span><strong>{info.lastBarTimeEt??'N/A'}</strong></div></div>
   <p className="intraday-source">IEX only · Provider pagination: <strong>{info.partialHistory?'Yes':'No'}</strong></p>
   <div className="entry-research">
    <h4>Historical entry checkpoints</h4>
    <p>Reference is the completed 15-minute bar closing immediately before each checkpoint. The later highs and lows use subsequent bars only; their ordering is unknown.</p>
    <div className="entry-grid">
     {windows.map(w=><article className="entry-card" key={w.time}>
      <div className="entry-time">{w.time} ET</div>
      <div className="entry-primary"><span>To session close</span><strong className={klass(w.toClose)}>{fmt(w.toClose)}</strong></div>
      <div className="entry-secondary"><span>Subsequent highest high</span><strong className={klass(w.highest)}>{fmt(w.highest)}</strong></div>
      <div className="entry-secondary"><span>Subsequent lowest low</span><strong className={klass(w.lowest)}>{fmt(w.lowest)}</strong></div>
      <small>Prior-bar reference: {w.reference===null?'N/A':'$'+w.reference.toFixed(2)}</small>
     </article>)}
    </div>
    <p className="intraday-caveat">A completed-bar close is not a guaranteed fill at the checkpoint. Extremes are not executable returns. Spreads, slippage, fees, latency, and catalyst discovery timing are not modeled. Research only.</p>
   </div>
   <p className="intraday-caveat">Coverage does not establish executable prices, spreads or liquidity across other exchanges.</p>
  </div>}
 </section>;
}
