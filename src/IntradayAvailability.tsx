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
  {info&&<div className="chart-note" role="status"><p>Available regular-session bars: <strong>{info.barCount} / 26 expected 15-minute intervals</strong></p><p>First: {info.firstBarTimeEt??'N/A'} ET · Last: {info.lastBarTimeEt??'N/A'} ET</p><p>Observed coverage: {info.fullRegularSession&&!info.partialHistory?'All 26 expected intervals':'Incomplete or unavailable'} · Provider pagination: {info.partialHistory?'Yes':'No'}</p><p>IEX is a single exchange. Even 26 returned intervals cannot validate spread, fill probability, or other venues' market activity.</p></div>}
 </section>;
}
