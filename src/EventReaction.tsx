import {useState} from 'react';
// @ts-ignore JavaScript-only research helpers.
import {eventStudy,easternClock} from './event-study.mjs';
// @ts-ignore JS-only benchmark comparator.
import {benchmarkRelative} from './benchmark-relative.mjs';
type Bar={date:string;close:number;high:number;low:number;volume:number};
type Response={bars:Bar[];adjustment:string;feed:string;partialHistory:boolean;completedSessionsOnly:boolean;error?:string};
type Study={status:string;reason:string;firstSession?:string;baselineSession?:string;firstSessionBreakdown?:{gapPct:number|null;regularSessionPct:number|null;open:number|null;referenceClose:number|null;sessionClose:number|null};returns:{day1:number|null;day3:number|null;day5:number|null};continuation?:{day3:number|null;day5:number|null};excursions?:{day1:{highPct:number;lowPct:number}|null;day3:{highPct:number;lowPct:number}|null;day5:{highPct:number;lowPct:number}|null}};
const pct=(n:number|null)=>n===null?'N/A':(n>=0?'+':'')+n.toFixed(2)+'%';
const tone=(n:number|null)=>n===null?'unavailable':n>0?'positive':n<0?'negative':'flat';
const horizons=[['day1','First session'],['day3','Third session'],['day5','Fifth session']] as const;
export default function EventReaction({ticker,acceptedAt}:{ticker:string;acceptedAt:string|null}){
 const [study,setStudy]=useState<Study|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [benchmark,setBenchmark]=useState<any>(null),[benchmarkNote,setBenchmarkNote]=useState('');
 async function analyze(){
  if(!acceptedAt)return;
  setBusy(true);setError('');setStudy(null);setBenchmark(null);setBenchmarkNote('');
  try{
   const eventDate=easternClock(acceptedAt)?.date;
   if(!eventDate)throw Error('Accepted timestamp lacks an explicit timezone');
   const params=new URLSearchParams({ticker,eventDate});
   const r=await fetch('/api/market/event?'+params);const data=await r.json() as Response;
   if(!r.ok)throw Error(data.error||'Historical prices unavailable');
   if(data.partialHistory||data.adjustment!=='split'||data.feed!=='IEX'||!data.completedSessionsOnly)throw Error('Market history is incomplete or lacks the expected safeguards');
   setStudy(eventStudy(acceptedAt,data.bars) as Study);
   try {
    const br=await fetch('/api/market/event?'+new URLSearchParams({ticker:'SPY',eventDate}));
    const bd=await br.json() as Response;
    if(!br.ok)throw Error(bd.error||'SPY history unavailable');
    if(bd.partialHistory||bd.adjustment!=='split'||bd.feed!=='IEX'||!bd.completedSessionsOnly)throw Error('Incomplete SPY history');
    setBenchmark(benchmarkRelative(acceptedAt,data.bars,bd.bars,eventStudy));
   }catch(e){setBenchmarkNote(e instanceof Error?e.message:'SPY comparison unavailable')}
  }catch(e){setError(e instanceof Error?e.message:'Could not analyze filing');}
  finally{setBusy(false)}
 }
 return <div>
  <button type="button" className="button" disabled={busy||!acceptedAt} onClick={analyze}>{busy?'Checking historical prices…':'Analyze price reaction'}</button>
  {!acceptedAt&&<small>SEC acceptance time unavailable; analysis disabled.</small>}
  {error&&<p className="real-error" role="alert">{error}</p>}
  {study&&<div className="chart-note event-reaction-panel">
    {study.status==='aligned'?<><strong>Cumulative return from pre-event close · IEX daily closes</strong><p>Reference close: {study.baselineSession} · First eligible session: {study.firstSession}</p>
     <div className="event-reaction-grid">{horizons.map(([key,label])=><div className={`event-reaction-card event-reaction-${tone(study.returns[key])}`} key={key}><span>{label} cumulative</span><strong>{pct(study.returns[key])}</strong></div>)}</div>
     <strong>First-session breakdown: overnight gap vs regular trading</strong>
     <p>Close-to-open and open-to-close are separate compound returns. Daily IEX opening prices do not establish when the move occurred during premarket hours or guarantee an executable opening fill.</p>
     <div className="event-reaction-grid event-continuation-grid">{([["gapPct","Previous close → first open"],["regularSessionPct","First open → first close"]] as const).map(([key,label])=><div className={`event-reaction-card event-reaction-${tone(study.firstSessionBreakdown?.[key]??null)}`} key={key}><span>{label}</span><strong>{pct(study.firstSessionBreakdown?.[key]??null)}</strong></div>)}</div>
     <strong>Continuation after the first session close</strong>
     <p>Separate returns measured from the first eligible session closing price. They are not added to the initial return.</p>
     <div className="event-reaction-grid event-continuation-grid">{([["day3","Through session 3"],["day5","Through session 5"]] as const).map(([key,label])=><div className={`event-reaction-card event-reaction-${tone(study.continuation?.[key]??null)}`} key={key}><span>{label}</span><strong>{pct(study.continuation?.[key]??null)}</strong></div>)}</div>
     <strong>Performance relative to SPY (percentage points)</strong>
     <p>ATLAS subtracts SPY's simple return over matching sessions. Positive means outperformance, not necessarily a positive stock return.</p>
     {benchmark?<><div className="event-reaction-grid">{horizons.map(([key,label])=><div className={`event-reaction-card event-reaction-${tone(benchmark.relative[key])}`} key={key}><span>{label} vs SPY</span><strong>{pct(benchmark.relative[key])}</strong></div>)}</div><p>Post-first-close relative to SPY: Session 3 <b>{pct(benchmark.continuation.day3)}</b> · Session 5 <b>{pct(benchmark.continuation.day5)}</b></p></>:<p>SPY comparison unavailable{benchmarkNote?': '+benchmarkNote:''}.</p>}
     <strong>Observed intraday range relative to reference close</strong>
     <div className="event-excursion-grid">{horizons.map(([key,label])=><div className="event-excursion-card" key={key}><span>{label}</span><div><span>Highest high</span><b className={`event-${tone(study.excursions?.[key]?.highPct??null)}`}>{pct(study.excursions?.[key]?.highPct??null)}</b></div><div><span>Lowest low</span><b className={`event-${tone(study.excursions?.[key]?.lowPct??null)}`}>{pct(study.excursions?.[key]?.lowPct??null)}</b></div></div>)}</div></>:<p>{study.reason}</p>}
    <p>Split-adjusted single-exchange prices; completed sessions only. The daily open is not a guaranteed tradeable fill, and IEX daily bars cannot isolate premarket price action. Cumulative returns use the pre-event close; continuation returns use the first-session close. High/low ranges are measured against the pre-event close; they are not entry-based MFE/MAE or achievable trade returns. Results are descriptive, not executable trade returns or evidence the filing caused the price move. A filing may have been announced elsewhere first.</p>
   </div>}
 </div>;
}
