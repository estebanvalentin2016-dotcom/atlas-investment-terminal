// Restrict research batches to recent filings with explicit timezone-aware SEC timestamps.
export function comparableFilings(filings,now=Date.now(),max=3){
 if(!Array.isArray(filings))return [];
 return filings.filter(f=>{
  if(typeof f?.acceptedAt!=='string'||!/(Z|[+-]\d{2}:?\d{2})$/.test(f.acceptedAt))return false;
  const ms=Date.parse(f.acceptedAt);
  return Number.isFinite(ms)&&ms<=now&&ms>=now-175*86400000;
 }).sort((a,b)=>Date.parse(b.acceptedAt)-Date.parse(a.acceptedAt)).slice(0,max);
}
