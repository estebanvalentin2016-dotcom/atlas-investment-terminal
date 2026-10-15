// Transparent triage, never a forecast or an inferred bullish signal.
export const STARTER_UNIVERSE=['CRWD','NVDA','MSFT','AMZN','META','GOOGL','PLTR','AVGO'];
export function triageFilings(responses,now=Date.now(),days=14){
 const cutoff=now-days*86400000;
 const rows=[];
 for(const response of responses){
  if(!response||!response.ticker||!Array.isArray(response.filings))continue;
  for(const f of response.filings){
   const ms=typeof f.acceptedAt==='string'?Date.parse(f.acceptedAt):NaN;
   if(!Number.isFinite(ms)||ms>now||ms<cutoff||!f.url||!/^https:\/\/www\.sec\.gov\//.test(f.url))continue;
   const items=String(f.items||'');
   const earnings=/(^|[,;\s])2\.02(?=$|[,;\s])/.test(items);
   const agreement=/(^|[,;\s])1\.01(?=$|[,;\s])/.test(items);
   if(!earnings&&!agreement)continue;
   const kind=earnings?'Earnings disclosure':'Material agreement disclosure';
   rows.push({ticker:response.ticker,name:response.name||response.ticker,accession:f.accession,acceptedAt:f.acceptedAt,url:f.url,kind,priority:earnings?2:1,daysOld:(now-ms)/86400000});
  }
 }
 rows.sort((a,b)=>b.priority-a.priority||Date.parse(b.acceptedAt)-Date.parse(a.acceptedAt)||a.ticker.localeCompare(b.ticker));
 return rows.slice(0,24);
}
