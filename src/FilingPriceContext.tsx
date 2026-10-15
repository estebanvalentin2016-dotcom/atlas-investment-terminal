import {toneForReturn} from './filing-metric-tone';
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
 const aligned=review?.acceptedContext?.status==='aligned';
 const primaryLeg=aligned?review?.acceptedContext?.firstEligible:review?.context.filingDay;
 const headline=primaryLeg??null;
 const headlineLabel=aligned?'First completed close eligible after SEC acceptance':review?.accepted?.sessionWindow==='after_regular_close'?'Filing-date close (BEFORE SEC acceptance)':'Filing-date close (timing not verified)';
 return <div className="filing-price-context">
  <button type="button" className="button secondary" onClick={()=>void inspect()} disabled={busy||!eventDate}>
   {busy?'Checking SEC time and market prices…':review?'Refresh price context':'Show the key price moves'}
  </button>
  {!eventDate&&<p className="chart-note">No filing date available for comparison.</p>}
  {error&&<p className="real-error" role="alert">{error}</p>}
  {review&&<div className="filing-price-body">
   <strong>Price movement at a glance</strong>
   <div className="atlas-key-return">
    <div><span className="atlas-glance-label">{headlineLabel}</span><strong className={"atlas-glance-value atlas-tone-"+toneForReturn(headline?.returnPct??null)}>{headline?fmtPct(headline.returnPct):'Waiting for data'}</strong>{headline&&<span>{headline.date} · close {fmtPrice(headline.close)}</span>}</div>
    <div><span className="atlas-glance-label">Compared with SPY (same sessions)</span><strong className={"atlas-glance-value atlas-tone-"+toneForReturn(headline?.vsSpyPercentagePoints??null)}>{headline?fmtPoints(headline.vsSpyPercentagePoints):'Unavailable'}</strong><span>Difference in returns, NOT statistical alpha</span></div>
   </div>
   <p className="atlas-summary-line"><strong>What this tells us:</strong> {review.accepted?.sessionWindow==='after_regular_close'&&!aligned?'The SEC accepted this filing after the close. We need the next completed trading session before checking the post-acceptance move.':aligned?'This is a completed-session move after SEC acceptance. The actual news might have been public earlier.':'These are observed daily returns. Without a reliable initial release time, we cannot say the filing caused the movement.'}</p>
   {review.accepted?<p className="atlas-summary-line"><strong>SEC received it:</strong> {review.accepted.acceptedEasternClock} · {review.accepted.sessionWindow==='after_regular_close'?'AFTER the market closed':review.accepted.sessionWindow==='before_regular_open'?'BEFORE the market opened':'DURING the trading day'}</p>:<p className="opportunity-uncertainty"><strong>SEC acceptance time unavailable.</strong> The filing-date move isn't proof of a catalyst reaction.</p>}
   {review.acceptedContext?.firstSessionMayIncludePriorTrading&&<p className="opportunity-uncertainty"><strong>Timing warning:</strong> This day's return includes trading that happened before SEC acceptance.</p>}
   <details className="atlas-details">
    <summary>See every completed-day price comparison</summary>
    {review.context.baseline&&<p><strong>Reference close:</strong> {review.context.baseline.date} · {fmtPrice(review.context.baseline.close)}</p>}
    <div className="filing-price-legs">
     <Leg heading="On filing date" value={review.context.filingDay}/>
     <Leg heading="First completed day after filing date" value={review.context.followingSession}/>
     <Leg heading="Last completed day in available window" value={review.context.lastCompletedInWindow}/>
    </div>
   </details>
   <details className="atlas-details">
    <summary>See SEC acceptance alignment and opening gap</summary>
    {review.accepted?<div className="atlas-technical-meta">
      <p><strong>Accepted:</strong> {review.accepted.acceptedEasternClock}</p>
      {review.acceptedContext?.baseline&&<p><strong>Reference before aligned session:</strong> {review.acceptedContext.baseline.date} · {fmtPrice(review.acceptedContext.baseline.close)}</p>}
      {review.acceptedContext?.status==='aligned'?<div className="filing-price-legs"><Leg heading="First eligible session" value={review.acceptedContext.firstEligible}/><Leg heading="Next completed session" value={review.acceptedContext.following}/><p><strong>Opening gap:</strong> {fmtPct(review.acceptedContext.gapPct)} · <strong>Open to close:</strong> {fmtPct(review.acceptedContext.regularSessionPct)}</p></div>:<p>{review.acceptedContext?.status==='pending_completed_session'?'No eligible completed session yet.':'Insufficient completed-session history.'}</p>}
    </div>:<p>SEC header could not be validated: {review.acceptedUnavailable||'Source unavailable'}.</p>}
   </details>
   <details className="atlas-details">
    <summary>Data quality and interpretation limits</summary>
    <p>Provider: Alpaca {review.feed}; {review.adjustment} adjusted daily bars. Only completed sessions.</p>
    <p>SEC acceptance is <strong>not</strong> verified first public announcement time. Any news may have been disclosed earlier.</p>
    <p>SPY comparison is a percentage-point difference, <strong>not</strong> an alpha estimate or expected future return. IEX prices may differ from consolidated trading.</p>
    {review.partialHistory&&<p><strong>Incomplete history:</strong> Alpaca reported a partial response.</p>}
    {review.benchmarkUnavailable&&<p><strong>SPY missing:</strong> {review.benchmarkUnavailable}</p>}
    <p>No earnings consensus surprise, valuation, or remaining-upside forecast is provided.</p>
   </details>
  </div>}
 </div>;
}
