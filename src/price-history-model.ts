// Long-range price context is a research-priority heuristic, not a forecast.
// The first Alpaca history bar is NEVER assumed to be an IPO or a total return.
export type HistoricalBar={date:string;close:number};
export type HistoricalPriceResponse={ticker:string;provider:string;feed:string;timeframe:string;adjustment:string;completedWeeksOnly:boolean;partialHistory:boolean;coverageStart:string;coverageEnd:string;bars:HistoricalBar[];note:string};
export type PriceHistoryAssessment={
 status:'usable'|'partial'|'stale'|'missing';
 latestDate:string|null;firstDate:string|null;observedYears:number|null;
 returns:{year1:number|null;year3:number|null;year5:number|null;year10:number|null;sinceAvailable:number|null};
 threeYearAnnualized:number|null;drawdownFrom52WeekHigh:number|null;
 trendScore:number|null;assessment:string;coverageNote:string;
};
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const elapsed=(newer:string,older:string)=>(Date.parse(newer+'T00:00:00Z')-Date.parse(older+'T00:00:00Z'))/86400000;
const round=(n:number)=>Math.round(n*100)/100;
const clamp=(n:number,low:number,high:number)=>Math.max(low,Math.min(high,n));
const priorYear=(date:string,years:number)=>{const d=new Date(date+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()-years);return d.toISOString().slice(0,10)};
export function assessPriceHistory(raw:HistoricalPriceResponse|null,asOf:string):PriceHistoryAssessment{
 const empty:PriceHistoryAssessment={status:'missing',latestDate:null,firstDate:null,observedYears:null,
  returns:{year1:null,year3:null,year5:null,year10:null,sinceAvailable:null},
  threeYearAnnualized:null,drawdownFrom52WeekHigh:null,trendScore:null,
  assessment:'Price trend unavailable',coverageNote:'No independently retrieved comparable split-adjusted price history.'};
 if(!raw||raw.provider!=='Alpaca'||raw.feed!=='IEX'||raw.timeframe!=='1Week'||raw.adjustment!=='split'||raw.completedWeeksOnly!==true||!validDate(asOf)||!Array.isArray(raw.bars))return empty;
 const bars=[...raw.bars].filter(b=>validDate(b.date)&&b.date<asOf&&Number.isFinite(b.close)&&b.close>0)
  .sort((a,b)=>a.date.localeCompare(b.date));
 if(bars.length<2||bars.some((b,i)=>i>0&&b.date===bars[i-1].date))return empty;
 const first=bars[0],latest=bars[bars.length-1],years=elapsed(latest.date,first.date)/365.25;
 const common={...empty,latestDate:latest.date,firstDate:first.date,observedYears:round(years)};
 if(raw.partialHistory)return {...common,status:'partial',assessment:'Incomplete paginated history',coverageNote:'Source pagination did not finish; price performance is withheld.'};
 if(elapsed(asOf,latest.date)>21)return {...common,status:'stale',assessment:'Historical prices stale',coverageNote:'Latest observed completed IEX weekly bar is more than 21 days old; historical signals withheld.'};
 const lookback=(years:number)=>{
  const target=priorYear(latest.date,years);
  const prior=[...bars].reverse().find(b=>b.date<=target);
  if(!prior||elapsed(target,prior.date)>28)return null;
  return round((latest.close/prior.close-1)*100);
 };
 const year1=lookback(1),year3=lookback(3),year5=lookback(5),year10=lookback(10);
 const sinceAvailable=round((latest.close/first.close-1)*100);
 const r3=year3!==null?round((Math.pow(1+year3/100,1/3)-1)*100):null;
 const trailing=bars.filter(b=>elapsed(latest.date,b.date)<=366);
 const high=Math.max(...trailing.map(b=>b.close));
 const drawdown=trailing.length>=35&&high>0?round((latest.close/high-1)*100):null;
 // 20% transparent research-priority weight is used ONLY with 1Y+3Y
 // split-adjusted coverage. Missing data never counts as a bullish signal.
 const trend=year1!==null&&r3!==null?round(clamp(50+0.45*year1+0.55*r3,0,100)):null;
 const assessment=trend===null?'Insufficient 1Y and 3Y price coverage':year1!==null&&r3!==null&&year1>0&&r3>0?'Positive 1Y and 3Y historical trend':year1!==null&&r3!==null&&year1<0&&r3<0?'Negative 1Y and 3Y historical trend':'Mixed long-term price trend';
 return {status:'usable',latestDate:latest.date,firstDate:first.date,observedYears:round(years),
  returns:{year1,year3,year5,year10,sinceAvailable},
  threeYearAnnualized:r3,drawdownFrom52WeekHigh:drawdown,trendScore:trend,assessment,
  coverageNote:'Alpaca IEX completed weekly closes, split-adjusted; dividends excluded. Earliest available bar is not the verified IPO price. Source coverage may omit early life or former ticker symbols.'};
}
export function combineResearchPriority(fundamentalScore:number|null,history:PriceHistoryAssessment|null){
 if(fundamentalScore===null||!Number.isFinite(fundamentalScore))return {score:null,priceWeighted:false};
 if(!history||history.status!=='usable'||history.trendScore===null)return {score:fundamentalScore,priceWeighted:false};
 return {score:Math.round(0.8*fundamentalScore+0.2*history.trendScore),priceWeighted:true};
}
