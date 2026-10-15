export type DailySummary={date:string;close:number;volume:number;day1:number|null;day3:number|null;day5:number|null;rvol:number|null;below20DayHighPct:number|null};
export type ScanRow={ticker:string;summary:DailySummary|null;error?:string;retrievedAt?:string;feed?:string;partialHistory?:boolean};
export function assessCandidate(s:DailySummary|null){
 if(!s||[s.day1,s.day3,s.day5,s.rvol,s.below20DayHighPct].some(v=>v===null||!Number.isFinite(v)))return {direction:'Insufficient data',reasons:['Missing comparable session metrics']};
 const d1=s.day1!,d3=s.day3!,d5=s.day5!,r=s.rvol!,high=s.below20DayHighPct!;
 if(d1>0&&d3>0&&d5>0&&r>=1.5&&high>=-5)return {direction:'Bullish follow-through candidate',reasons:['Positive 1/3/5-session returns','IEX relative volume at least 1.5×','Close within 5% of 20-session high']};
 if(d1<0&&d3<0&&d5<0&&r>=1.5)return {direction:'Bearish follow-through candidate',reasons:['Negative 1/3/5-session returns','IEX relative volume at least 1.5×']};
 return {direction:'No qualifying pattern',reasons:['One or more illustration-only thresholds not met']};
}
export function parseWatchlist(raw:string){return [...new Set(raw.toUpperCase().split(/[\s,;]+/).map(x=>x.trim()).filter(Boolean))].filter(x=>/^[A-Z0-9.-]{1,12}$/.test(x)).slice(0,8)}
