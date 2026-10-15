import type {PriceBar,PriceLeg} from './filing-price-context';
export type AcceptanceClock={acceptedEasternDate:string;acceptedEasternTime:string;acceptedEasternClock:string;sessionWindow:'before_regular_open'|'during_regular_session'|'after_regular_close';provenance:string;firstPublicReleaseVerified:boolean};
export type AcceptanceSessionResult={
 status:'pending_completed_session'|'insufficient_history'|'aligned';
 baseline:{date:string;close:number}|null;
 firstEligible:PriceLeg|null;
 following:PriceLeg|null;
 gapPct:number|null;
 regularSessionPct:number|null;
 firstSessionMayIncludePriorTrading:boolean;
};
const round=(n:number)=>Math.round(n*100)/100;
const validBar=(bar:PriceBar)=>bar&&/^\d{4}-\d{2}-\d{2}$/.test(bar.date)&&Number.isFinite(bar.close)&&bar.close>0;
export function acceptanceSessionContext(raw:PriceBar[],rawSpy:PriceBar[],accepted:AcceptanceClock):AcceptanceSessionResult{
 const bars=raw.filter(validBar).slice().sort((a,b)=>a.date.localeCompare(b.date));
 const spy=rawSpy.filter(validBar).slice().sort((a,b)=>a.date.localeCompare(b.date));
 const day=accepted.acceptedEasternDate;
 const afterClose=accepted.sessionWindow==='after_regular_close';
 const candidate=(date:string)=>date>day||(!afterClose&&date===day);
 const baselineCandidates=bars.filter(b=>afterClose?b.date<=day:b.date<day);
 const lastBaseline=baselineCandidates.at(-1);
 const baseline=lastBaseline?{date:lastBaseline.date,close:lastBaseline.close}:null;
 const first=bars.find(b=>candidate(b.date));
 const empty:AcceptanceSessionResult={status:baseline?'pending_completed_session':'insufficient_history',baseline,firstEligible:null,following:null,gapPct:null,regularSessionPct:null,firstSessionMayIncludePriorTrading:accepted.sessionWindow==='during_regular_session'};
 if(!first)return empty;
 const index=bars.indexOf(first);
 const previous=bars[index-1];
 if(!previous||!validBar(previous))return {...empty,status:'insufficient_history'};
 // With a completed first eligible bar, the immediately preceding real session
 // is the reference. Do not construct a session over weekends or holidays.
 const reference={date:previous.date,close:previous.close};
 const spyByDay=new Map(spy.map(b=>[b.date,b]));
 const benchmarkBaseline=spyByDay.get(reference.date);
 const toLeg=(bar:PriceBar|undefined):PriceLeg|null=>{
  if(!bar)return null;
  const stockPct=round((bar.close/reference.close-1)*100);
  const spyClose=spyByDay.get(bar.date);
  const spyPct=benchmarkBaseline&&spyClose?round((spyClose.close/benchmarkBaseline.close-1)*100):null;
  return {date:bar.date,close:bar.close,returnPct:stockPct,spyReturnPct:spyPct,vsSpyPercentagePoints:spyPct===null?null:round(stockPct-spyPct)};
 };
 return {status:'aligned',baseline:reference,firstEligible:toLeg(first),following:toLeg(bars[index+1]),
  gapPct:Number.isFinite(first.open)&&first.open>0?round((first.open/reference.close-1)*100):null,
  regularSessionPct:Number.isFinite(first.open)&&first.open>0?round((first.close/first.open-1)*100):null,
  firstSessionMayIncludePriorTrading:accepted.sessionWindow==='during_regular_session'};
}
