import {useState} from 'react';
// @ts-ignore JavaScript-only research helpers.
import {eventStudy,easternClock} from './event-study.mjs';
type Bar={date:string;close:number;high:number;low:number;volume:number};
type Response={bars:Bar[];adjustment:string;feed:string;partialHistory:boolean;completedSessionsOnly:boolean;error?:string};
type Study={status:string;reason:string;firstSession?:string;baselineSession?:string;returns:{day1:number|null;day3:number|null;day5:number|null};excursions?:{day1:{highPct:number;lowPct:number}|null;day3:{highPct:number;lowPct:number}|null;day5:{highPct:number;lowPct:number}|null}};
const pct=(n:number|null)=>n===null?'N/A':(n>=0?'+':'')+n.toFixed(2)+'%';
const tone=(n:number|null)=>n===null?'unavailable':n>0?'positive':n<0?'negative':'flat';
const horizons=[['day1','First session'],['day3','Third session'],['day5','Fifth session']] as const;
export default function EventReaction({ticker,acceptedAt}:{ticker:string;acceptedAt:string|null}){
 const [study,setStudy]=useState<Study|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function analyze(){
  if(!acceptedAt)return;
  setBusy(true);setError('');setStudy(null);
  try{
   const eventDate=easternClock(acceptedAt)?.date;
   if(!eventDate)throw Error('Accepted timestamp lacks an explicit timezone');
   const params=new URLSearchParams({ticker,eventDate});
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
  {study&&<div className="chart-note event-reaction-panel">
    {study.status==='aligned'?<><strong>Historical price reaction · IEX daily closes</strong><p>Reference close: {study.baselineSession} · First eligible session: {study.firstSession}</p>
     <div className="event-reaction-grid">{horizons.map(([key,label])=><div className={`event-reaction-card event-reaction-${tone(study.returns[key])}`} key={key}><span>{label} close</span><strong>{pct(study.returns[key])}</strong></div>)}</div>
     <strong>Observed intraday range relative to reference close</strong>
     <div className="event-excursion-grid">{horizons.map(([key,label])=><div className="event-excursion-card" key={key}><span>{label}</span><div><span>Highest high</span><b className={study.excursions?.[key]?"event-up":""}>{pct(study.excursions?.[key]?.highPct??null)}</b></div><div><span>Lowest low</span><b className={study.excursions?.[key]?"event-down":""}>{pct(study.excursions?.[key]?.lowPct??null)}</b></div></div>)}</div></>:<p>{study.reason}</p>}
    <p>Split-adjusted single-exchange prices; completed sessions only. High/low ranges are measured against the pre-event close; they are not entry-based MFE/MAE or achievable trade returns. Results are descriptive, not executable trade returns or evidence the filing caused the price move. A filing may have been announced elsewhere first.</p>
   </div>}
 </div>;
}
