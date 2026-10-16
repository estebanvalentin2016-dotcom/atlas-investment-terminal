// Explicit bridge between zero-ticker Autonomous Discovery and the Home
// catalyst research queue. Browser-local, bounded, source-dated screening
// observations; they do NOT create verified picks or buy ratings.
export type SavedPreliminaryPass={ticker:string;observedAt:string;annualFiled:string;preliminaryScore:number};
export const KEY='atlas.autonomous.preliminary-passes.v1';
const day=(s:string)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function mergeSavedPasses(previous:SavedPreliminaryPass[],current:SavedPreliminaryPass[],asOf:string):SavedPreliminaryPass[]{
 if(!day(asOf))return [];
 const fresh=(date:string)=>Date.parse(date+'T00:00:00Z');
 const latest=new Map<string,SavedPreliminaryPass>();
 for(const x of [...previous,...current]){
  if(!x||!/^[A-Z0-9.-]{1,12}$/.test(x.ticker)||!day(x.observedAt)||!day(x.annualFiled)||
   x.observedAt>asOf||x.annualFiled>x.observedAt||fresh(asOf)-fresh(x.observedAt)>95*86400000||
   !Number.isFinite(x.preliminaryScore)||x.preliminaryScore<0||x.preliminaryScore>100)continue;
  const existing=latest.get(x.ticker);
  if(!existing||existing.observedAt<x.observedAt)latest.set(x.ticker,x);
 }
 return [...latest.values()].sort((a,b)=>b.observedAt.localeCompare(a.observedAt)||a.ticker.localeCompare(b.ticker)).slice(0,200);
}
export function readSavedPasses(asOf:string):SavedPreliminaryPass[]{
 try{return mergeSavedPasses(JSON.parse(localStorage.getItem(KEY)||'[]') as SavedPreliminaryPass[],[],asOf)}catch{return []}
}
export function writeSavedPasses(items:SavedPreliminaryPass[],asOf:string):void{
 try{localStorage.setItem(KEY,JSON.stringify(mergeSavedPasses(readSavedPasses(asOf),items,asOf)))}catch{/* Private browsing / unavailable storage */}
}
