import {useState} from 'react';

type OvernightBar = {timeEt:number;open:number;high:number;low:number;close:number;volume:number};
type Result = {
 status:string;
 reason?:string;
 barCount?:number;
 near2amBars?:number;
 observed2amWindow?:OvernightBar[];
 partialHistory?:boolean;
 robinhoodHistoricalEligibility:string;
 executionPrice:string;
 error?:string;
};

const dollars=(amount:number)=>'$'+amount.toFixed(2);
const clock=(minutes:number)=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');

export default function OvernightProbe({ticker,session}:{ticker:string;session:string}){
 const [value,setValue]=useState<Result|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');

 async function check(){
  setLoading(true);
  setError('');
  setValue(null);
  try {
   const query=new URLSearchParams({ticker,session});
   const response=await fetch('/api/market/overnight-probe?'+query.toString());
   const result=await response.json() as Result;
   if(!response.ok)throw new Error(result.error||'Overnight data unavailable');
   setValue(result);
  }catch(err){
   setError(err instanceof Error?err.message:'Could not check overnight data');
  }finally{
   setLoading(false);
  }
 }

 return (
  <section className="overnight-probe">
   <h4>2:00 AM overnight opportunity research</h4>
   <p>Robinhood is your trading broker. Alpaca supplies historical market data only. Check for Blue Ocean (BOATS) observations around 2:00 AM Eastern on {session}.</p>
   <button type="button" className="button" onClick={check} disabled={loading}>{loading?'Checking overnight history…':'Check 2 AM historical data'}</button>
   {error&&<p role="alert" className="real-error">{error}</p>}
   {value&&(
    <div className="overnight-results" role="status">
     <div className="overnight-lead">
      <strong>{value.status}</strong>
      <span>{value.reason||'Historical BOATS observations, not Robinhood trade records'}</span>
     </div>
     <div className="overnight-stats">
      <div><small>Overnight 15-minute bars</small><strong>{value.barCount??'N/A'}</strong></div>
      <div><small>Bars around 2 AM</small><strong>{value.near2amBars??'N/A'}</strong></div>
      <div><small>Robinhood eligibility that night</small><strong>Unknown</strong></div>
     </div>
     {value.observed2amWindow&&value.observed2amWindow.length>0&&(
      <div className="overnight-observations">
       <strong>Observed BOATS intervals, 1:45–2:15 AM ET</strong>
       {value.observed2amWindow.map(bar=>(
        <div key={bar.timeEt}>
         <span>{clock(bar.timeEt)} ET</span>
         <span>O {dollars(bar.open)} · H {dollars(bar.high)} · L {dollars(bar.low)} · C {dollars(bar.close)}</span>
         <span>Volume {bar.volume.toLocaleString()}</span>
        </div>
       ))}
      </div>
     )}
     {value.partialHistory&&<p className="real-error">Provider reports partial history. Do not infer missing price movement.</p>}
     <p>BOATS observations cannot establish historical Robinhood symbol eligibility, quotes, order acceptance, or attainable execution prices. This is research only.</p>
    </div>
   )}
  </section>
 );
}
