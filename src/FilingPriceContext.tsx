import {useState} from 'react';
import {filingPriceContext,type PriceBar,type PriceContext,type PriceLeg} from './filing-price-context';

type MarketResult={bars:PriceBar[];ticker:string;feed:string;provider:string;adjustment:string;retrievedAt:string;partialHistory:boolean;completedSessionsOnly:boolean;error?:string};
type Review={context:PriceContext;feed:string;adjustment:string;retrievedAt:string;partialHistory:boolean;benchmarkUnavailable:string|null};
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
export default function FilingPriceContext({ticker,eventDate}:{ticker:string;eventDate:string|null}){
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
   setReview({context,feed:primary.feed,adjustment:primary.adjustment,retrievedAt:primary.retrievedAt,partialHistory:primary.partialHistory,benchmarkUnavailable});
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
   {review.benchmarkUnavailable&&<p className="chart-note">SPY comparison unavailable: {review.benchmarkUnavailable}</p>}
   {review.partialHistory&&<p className="opportunity-uncertainty">The Alpaca response indicated partial history. Missing bars may affect this comparison.</p>}
   <p className="chart-note">SPY comparison is a simple return difference in percentage points, not statistical alpha or beta-adjusted performance. IEX-only pricing may differ from consolidated market prices. No earnings-surprise estimate, release-time verification, remaining-upside forecast, or trade signal is produced.</p>
  </div>}
 </div>;
}
