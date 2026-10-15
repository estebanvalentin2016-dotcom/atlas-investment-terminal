import {useState} from 'react';
// @ts-ignore JavaScript-only research helpers.
import {eventStudy} from './event-study.mjs';
type Bar={date:string;close:number;volume:number};
type Response={bars:Bar[];adjustment:string;feed:string;partialHistory:boolean;completedSessionsOnly:boolean;error?:string};
type Study={status:string;reason:string;firstSession?:string;baselineSession?:string;returns:{day1:number|null;day3:number|null;day5:number|null}};
const pct=(n:number|null)=>n===null?'N/A':(n>=0?'+':'')+n.toFixed(2)+'%';
export default function EventReaction({ticker,acceptedAt,date}:{ticker:string;acceptedAt:string|null;date:string}){
 const [study,setStudy]=useState<Study|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function analyze(){
  if(!acceptedAt)return;
  setBusy(true);setError('');setStudy(null);
  try{
   const params=new URLSearchParams({ticker,eventDate:date});
   const r=await fetch('/api/market/event?'+params);const data=await r.json() as Response;
   if(!r.ok)throw Error(data.error||'Historical prices unavailable');
   if(data.partialHistory||data.adjustment!=='split'||data.feed!=='IEX'||!data.completedSessionsOnly)throw Error('Market history is incomplete or lacks the expected safeguards');
   setStudy(eventStudy(acceptedAt,data.bars) as Study);
  }catch(e){setError(e instanceof Error?e.message:'Could not analyze filing');}
  finally{setBusy(false)}
 }
 return <div>
  <button type="button" className="button" disabled={busy||!acceptedAt} onClick={analyze}>{busy?'Checking historical prices…':'Analyze price reaction'}</button>
  {!acceptedAt&&<small>SEC acceptance time unavailable; analysis disabled.</small>}
  {error&&<p className="real-error" role="alert">{error}</p>}
  {study&&<div className="chart-note">
    {study.status==='aligned'?<><strong>Historical price reaction · IEX daily closes</strong><p>Reference close: {study.baselineSession} · First eligible session: {study.firstSession}</p>
     <p>First-session close: {pct(study.returns.day1)} · Third-session close: {pct(study.returns.day3)} · Fifth-session close: {pct(study.returns.day5)}</p></>:<p>{study.reason}</p>}
    <p>Split-adjusted single-exchange prices; completed sessions only. Results are descriptive, not executable trade returns or evidence the filing caused the price move. A filing may have been announced elsewhere first.</p>
   </div>}
 </div>;
}
