import {useState} from 'react';
type Probe={barCount:number;firstBarTimeEt:string|null;lastBarTimeEt:string|null;fullRegularSession:boolean;partialHistory:boolean;feed:string;timeframe:string;error?:string};
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
 return <section className="event-intraday-check">
  <strong>Intraday feasibility · 15-minute IEX bars</strong>
  <p>Check whether the free data source has regular-session historical bars for {session}. This only checks coverage; it does not calculate hypothetical entry returns or prove an executable trade.</p>
  <button type="button" className="button" onClick={check} disabled={loading}>{loading?'Checking coverage…':'Check 15-minute data availability'}</button>
  {error&&<p className="real-error" role="alert">{error}</p>}
  {info&&<div className="intraday-results" role="status">
   <div className="intraday-results-heading"><strong>Historical intraday coverage</strong><span className={info.fullRegularSession&&!info.partialHistory?'intraday-status-complete':'intraday-status-partial'}>{info.fullRegularSession&&!info.partialHistory?'All expected intervals':'Incomplete coverage'}</span></div>
   <div className="intraday-metrics"><div><span>15-minute bars</span><strong>{info.barCount}<small> / 26</small></strong></div><div><span>First bar · ET</span><strong>{info.firstBarTimeEt??'N/A'}</strong></div><div><span>Last bar · ET</span><strong>{info.lastBarTimeEt??'N/A'}</strong></div></div>
   <p className="intraday-source">IEX only · Provider pagination: <strong>{info.partialHistory?'Yes':'No'}</strong></p>
   <p className="intraday-caveat">Coverage does not establish executable prices, spreads, or liquidity across other exchanges.</p>
  </div>}
 </section>;
}
