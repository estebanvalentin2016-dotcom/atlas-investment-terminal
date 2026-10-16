// The 90-day ledger is locally observed SEC discovery history, NOT a
// retrospectively exhaustive 90-day market scan or a validated top-picks list.
export type PickLead={ticker:string;name:string;filed:string|null;form:string;url:string;discoveredOn?:string;kind:string};
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export const effectiveDate=(lead:PickLead)=>lead.filed&&validDate(lead.filed)?lead.filed:null;
export function retainPickLeads(previous:PickLead[],latest:PickLead[],asOf:string):PickLead[]{
 if(!validDate(asOf))return [];
 const min=new Date(Date.parse(asOf+'T00:00:00Z')-91*86400000).toISOString().slice(0,10);
 const seen=new Map<string,PickLead>();
 for(const row of [...previous,...latest]){
  if(!row||!effectiveDate(row)||!row.ticker||!/^[A-Z0-9.-]{1,12}$/.test(row.ticker)||
   !['8-K','8-K/A'].includes(row.form)||typeof row.url!=='string'||
   !/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/[\w./-]+\.txt$/.test(row.url))continue;
  const date=effectiveDate(row)!;
  if(date<min||date>asOf)continue;
  seen.set(row.url,{ticker:row.ticker,name:row.name||row.ticker,filed:date,form:row.form,url:row.url,discoveredOn:row.discoveredOn,kind:row.kind||'8-K (unreviewed)'});
 }
 return [...seen.values()].sort((a,b)=>(b.filed??'').localeCompare(a.filed??'')||a.ticker.localeCompare(b.ticker)).slice(0,750);
}
export function thisMonth(leads:PickLead[],asOf:string):PickLead[]{
 if(!validDate(asOf))return [];
 return leads.filter(x=>effectiveDate(x)?.slice(0,7)===asOf.slice(0,7));
}
export function distinctIssuers(leads:PickLead[],count:number):PickLead[]{
 const seen=new Set<string>();
 return leads.filter(r=>{if(seen.has(r.ticker))return false;seen.add(r.ticker);return true}).slice(0,count);
}
