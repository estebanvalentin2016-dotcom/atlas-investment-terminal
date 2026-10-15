import {useState} from 'react';
import {filingPriceContext,type PriceBar,type PriceContext,type PriceLeg} from './filing-price-context';
import {acceptanceSessionContext,type AcceptanceClock,type AcceptanceSessionResult} from './acceptance-session-context';

type MarketResult={bars:PriceBar[];ticker:string;feed:string;provider:string;adjustment:string;retrievedAt:string;partialHistory:boolean;completedSessionsOnly:boolean;error?:string};
type Review={context:PriceContext;feed:string;adjustment:string;retrievedAt:string;partialHistory:boolean;benchmarkUnavailable:string|null;accepted:AcceptanceClock|null;acceptedContext:AcceptanceSessionResult|null;acceptedUnavailable:string|null};
type AcceptedResponse={sourceStatus:'verified_header'|'unavailable';accepted:AcceptanceClock|null;note:string;error?:string};
async function getRawSecAcceptance(sourceUrl:string):Promise<AcceptedResponse>{
 const response=await fetch('/api/opportunities/acceptance?url='+encodeURIComponent(sourceUrl));
 const result=await response.json() as AcceptedResponse;
 if(!response.ok)throw Error(result.error||'SEC acceptance-time service failed');
 return result;
}
const fmtPrice=(n:number)=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPct=(n:number|null)=>n===null?'Unavailable':(n>0?'+':'')+n.toFixed(2)+'%';
const fmtPoints=(n:number|null)=>n===null?'Unavailable':(n>0?'+':'')+n.toFixed(2)+' percentage points';
async function getBars(ticker:string,eventDate:string):Promise<MarketResult>{
 const url='/api/market/event?ticker='+encodeURIComponent(ticker)+'&eventDate='+encodeURIComponent(eventDate);
 const response=await fetch(url);
 const body=await response.json() as MarketResult;
 if(!response.ok)throw Error(body.error||'Historical market data unavailable');
 if(!Array.isArray(body.bars)||body.completedSessionsOnly!==true||body.feed!=='IEX')throw Error('Unexpected historical market-data response');
 return body;
}
function Leg({heading,value}:{heading:string;value:PriceLeg|null}){
 return <div className="filing-price-leg">
  <strong>{heading}</strong>
  {value?<><p>{value.date} · Close {fmtPrice(value.close)}</p><p>Stock vs baseline: {fmtPct(value.returnPct)}</p><p>SPY over matching sessions: {fmtPct(value.spyReturnPct)}</p><p>Difference from SPY: {fmtPoints(value.vsSpyPercentagePoints)}</p></>:<p>Completed matching session unavailable</p>}
 </div>;
}
export default function FilingPriceContext({ticker,eventDate,sourceUrl}:{ticker:string;eventDate:string|null;sourceUrl:string}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [review,setReview]=useState<Review|null>(null);
 async function inspect(){
  if(!eventDate||busy)return;
  setBusy(true);setError('');setReview(null);
  try{
   const primary=await getBars(ticker,eventDate);
   let benchmark:PriceBar[]=[];let benchmarkUnavailable:string|null=null;
   try{benchmark=(await getBars('SPY',eventDate)).bars}
   catch(e){benchmarkUnavailable=e instanceof Error?e.message:'SPY benchmark unavailable'}
   const context=filingPriceContext(primary.bars,benchmark,eventDate);
   let accepted:AcceptanceClock|null=null,acceptedUnavailable:string|null=null;
   try{
    const sec=await getRawSecAcceptance(sourceUrl);
    if(sec.sourceStatus==='verified_header'&&sec.accepted)accepted=sec.accepted;
    else acceptedUnavailable=sec.note||'SEC header acceptance time unavailable';
   }catch(e){acceptedUnavailable=e instanceof Error?e.message:'SEC header acceptance time unavailable'}
   const acceptedContext=accepted?acceptanceSessionContext(primary.bars,benchmark,accepted):null;
   setReview({context,feed:primary.feed,adjustment:primary.adjustment,retrievedAt:primary.retrievedAt,partialHistory:primary.partialHistory,benchmarkUnavailable,accepted,acceptedContext,acceptedUnavailable});
  }catch(e){setError(e instanceof Error?e.message:'Unable to assess price context')}
  finally{setBusy(false)}
 }
 return <div className="filing-price-context">
  <button type="button" className="button secondary" onClick={()=>void inspect()} disabled={busy||!eventDate}>{busy?'Retrieving completed IEX sessions…':review?'Refresh price context':'Check filing-date price context'}</button>
  {!eventDate&&<p className="chart-note">Filing date is unavailable; price context cannot be aligned.</p>}
  {error&&<p className="real-error" role="alert">{error}</p>}
  {review&&<div className="filing-price-body">
   <strong>Observed market-price context</strong>
   <p className="chart-note">Daily bars from Alpaca {review.feed}, split-adjusted, completed sessions only. Filing date {review.context.eventDate} is NOT a verified public-announcement timestamp. Price changes cannot be attributed to the filing.</p>
   {review.context.baseline?<p>Reference close: {review.context.baseline.date} · {fmtPrice(review.context.baseline.close)}</p>:<p className="opportunity-uncertainty">No preceding completed close was returned. Price comparisons unavailable.</p>}
   <div className="filing-price-legs">
    <Leg heading="Filing-date close" value={review.context.filingDay}/>
    <Leg heading="First completed close after filing date" value={review.context.followingSession}/>
    <Leg heading="Last completed close in available window" value={review.context.lastCompletedInWindow}/>
   </div>
   <div className="filing-acceptance-context">
    <strong>SEC acceptance-clock alignment</strong>
    {review.accepted?<><p>{review.accepted.acceptedEasternClock} · {review.accepted.sessionWindow==='after_regular_close'?'After the 4 PM ET regular close':review.accepted.sessionWindow==='before_regular_open'?'Before the 9:30 AM ET regular open':'During the regular session'}</p><p className="chart-note">Source: raw EDGAR SGML acceptance header (accession matched). This is when the SEC accepted the filing, NOT verified first-public issuer disclosure.</p>
      {review.acceptedContext?.baseline&&<p>Pre-alignment reference close: {review.acceptedContext.baseline.date} · {fmtPrice(review.acceptedContext.baseline.close)}</p>}
      {review.acceptedContext?.status==='aligned'?<div className="filing-price-legs"><Leg heading="First completed close eligible after SEC acceptance" value={review.acceptedContext.firstEligible}/><Leg heading="Next completed close after that" value={review.acceptedContext.following}/><p>First eligible-session opening gap: {fmtPct(review.acceptedContext.gapPct)} · Open-to-close: {fmtPct(review.acceptedContext.regularSessionPct)}</p></div>:<p className="opportunity-uncertainty">{review.acceptedContext?.status==='pending_completed_session'?'No completed session eligible after SEC acceptance is available yet.':'Not enough completed-session history to align the SEC acceptance clock.'}</p>}
      {review.acceptedContext?.firstSessionMayIncludePriorTrading&&<p className="opportunity-uncertainty">SEC accepted this filing during regular trading. A previous-close-to-session-close return includes trading that occurred BEFORE SEC acceptance; it must not be read as the filing's impact.</p>}
      {review.accepted.sessionWindow==='after_regular_close'&&<p className="chart-note">The filing-date close occurred before SEC acceptance. It is a pre-acceptance reference, not an event reaction.</p>}
    </>:<p className="chart-note">SEC acceptance clock unavailable: {review.acceptedUnavailable||'No validated header time'}. Filing-date context above remains descriptive only.</p>}
   </div>
   {review.benchmarkUnavailable&&<p className="chart-note">SPY comparison unavailable: {review.benchmarkUnavailable}</p>}
   {review.partialHistory&&<p className="opportunity-uncertainty">The Alpaca response indicated partial history. Missing bars may affect this comparison.</p>}
   <p className="chart-note">SPY comparison is a simple return difference in percentage points, not statistical alpha or beta-adjusted performance. IEX-only pricing may differ from consolidated market prices. No earnings-surprise estimate, release-time verification, remaining-upside forecast, or trade signal is produced.</p>
  </div>}
 </div>;
}
