// Filing-date-adjacent market context, not a causal event study.
// Daily SEC filing dates do not establish public announcement time.
export type PriceBar={date:string;open:number;high:number;low:number;close:number;volume:number};
export type PriceLeg={date:string;close:number;returnPct:number;spyReturnPct:number|null;vsSpyPercentagePoints:number|null};
export type PriceContext={
 eventDate:string;
 baseline:{date:string;close:number}|null;
 filingDay:PriceLeg|null;
 followingSession:PriceLeg|null;
 lastCompletedInWindow:PriceLeg|null;
 hasFollowingSession:boolean;
 status:'ok'|'no_prior_close'|'no_completed_post_filing_session';
};
const validDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
const validBar=(bar:PriceBar)=>bar&&validDate(bar.date)&&Number.isFinite(bar.close)&&bar.close>0;
const returns=(close:number,base:number)=>Math.round((close/base-1)*10000)/100;
export function filingPriceContext(raw:PriceBar[],benchmark:PriceBar[],eventDate:string):PriceContext{
 if(!validDate(eventDate))throw Error('Invalid filing date');
 const bars=raw.filter(validBar).sort((a,b)=>a.date.localeCompare(b.date));
 const spy=benchmark.filter(validBar).sort((a,b)=>a.date.localeCompare(b.date));
 const baseline=bars.filter(b=>b.date<eventDate).at(-1)||null;
 const noBaseline:PriceContext={eventDate,baseline:null,filingDay:null,followingSession:null,lastCompletedInWindow:null,hasFollowingSession:false,status:'no_prior_close'};
 if(!baseline)return noBaseline;
 const spyByDay=new Map(spy.map(b=>[b.date,b]));
 const benchmarkBaseline=spyByDay.get(baseline.date);
 const makeLeg=(bar:PriceBar|null):PriceLeg|null=>{
  if(!bar)return null;
  const spyNow=spyByDay.get(bar.date);
  const spyPct=benchmarkBaseline&&spyNow?returns(spyNow.close,benchmarkBaseline.close):null;
  const pct=returns(bar.close,baseline.close);
  return {date:bar.date,close:bar.close,returnPct:pct,spyReturnPct:spyPct,vsSpyPercentagePoints:spyPct===null?null:Math.round((pct-spyPct)*100)/100};
 };
 const later=bars.filter(b=>b.date>=eventDate);
 if(!later.length)return {...noBaseline,baseline:{date:baseline.date,close:baseline.close},status:'no_completed_post_filing_session'};
 const filingDay=bars.find(b=>b.date===eventDate)||null;
 const followingSession=bars.find(b=>b.date>eventDate)||null;
 return {eventDate,baseline:{date:baseline.date,close:baseline.close},filingDay:makeLeg(filingDay),followingSession:makeLeg(followingSession),lastCompletedInWindow:makeLeg(later.at(-1)||null),hasFollowingSession:!!followingSession,status:'ok'};
}
