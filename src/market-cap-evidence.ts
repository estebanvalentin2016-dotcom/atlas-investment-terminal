import type {Annual,MarketValuationClose,SecCompany} from './ranking-model';

export type MarketCapEvidence={
 status:'indicative'|'unavailable'|'ambiguous';
 estimate:number|null;
 shares:{value:number;end:string;filed:string;form:string;accession:string;tag:string}|null;
 priceDate:string|null;
 iex20:NonNullable<MarketValuationClose['iex20']>|null;
 notes:string[];
 source:string|null;
};
const day=(s:string)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const days=(newer:string,older:string)=>(Date.parse(newer+'T00:00:00Z')-Date.parse(older+'T00:00:00Z'))/86400000;
const allowed=new Set(['10-K','10-Q','10-K/A','10-Q/A']);

/** SEC DEI instant shares * IEX raw close is an indicative, dated estimate only.
 *  It never verifies share classes, splits, float, or consolidated trading liquidity. */
export function deriveMarketCapEvidence(company:SecCompany|null,quote:MarketValuationClose|null,today:string):MarketCapEvidence{
 const notes:string[]=[];
 const base={status:'unavailable' as const,estimate:null,shares:null,priceDate:quote?.sessionDate??null,iex20:null,notes,source:company?.source??null};
 if(!company||!company.source?.startsWith('https://data.sec.gov/')){notes.push('Source-backed SEC issuer facts unavailable.');return base}
 if(!quote||quote.ticker!==company.ticker||quote.feed!=='IEX'||!quote.completedSession||
    !Number.isFinite(quote.price)||quote.price<=0||!day(quote.sessionDate)||!day(today)||
    days(today,quote.sessionDate)<0||days(today,quote.sessionDate)>10){
  notes.push('Fresh completed IEX price for the same issuer is unavailable.');return base;
 }
 const iex=quote.iex20;
 const iex20=iex&&iex.sessionCount===20&&day(iex.startDate)&&day(iex.endDate)&&iex.startDate<=iex.endDate&&iex.endDate<=quote.sessionDate&&
  Number.isFinite(iex.avgDailyIexShares)&&iex.avgDailyIexShares>0&&Number.isFinite(iex.avgDailyIexDollarVolume)&&iex.avgDailyIexDollarVolume>0?iex:null;
 if(!iex20)notes.push('Full 20-session IEX observed volume is unavailable; consolidated volume, bid-ask spreads and free float are not assessed.');
 else notes.push('20-session activity covers Alpaca IEX alone, not consolidated market liquidity.');
 const metric=company.metrics.find(m=>m.name==='Common shares outstanding (DEI)');
 const rows=(metric?.values??[]).filter((v:Annual)=>
  day(v.end)&&day(v.filed)&&v.end<=v.filed&&v.filed<=quote.sessionDate&&v.end<=quote.sessionDate&&
  allowed.has(v.form)&&/^\d{10}-\d{2}-\d{6}$/.test(v.accession)&&Number.isSafeInteger(v.value)&&v.value>0
 ).sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed));
 if(!rows.length){notes.push('No eligible SEC DEI point-in-time common shares were filed by the closing-price date. Fiscal weighted-average diluted shares are not substituted.');return {...base,priceDate:quote.sessionDate,iex20}}
 const last=rows[0];
 const shares={value:last.value,end:last.end,filed:last.filed,form:last.form,accession:last.accession,tag:'EntityCommonStockSharesOutstanding'};
 // Contradictory counts in one report can represent different share classes.
 if(rows.some(r=>r.end===last.end&&r.accession===last.accession&&r.value!==last.value)){
  notes.push('Conflicting DEI counts appear in the same filing. Share classes or dimensions require manual reconciliation; no capitalization estimate is computed.');
  return {...base,status:'ambiguous',shares,priceDate:quote.sessionDate,iex20};
 }
 if(days(quote.sessionDate,last.end)>135){
  notes.push('The latest observed SEC outstanding-share date is more than 135 days older than the IEX close; no capitalization estimate is computed.');
  return {...base,shares,priceDate:quote.sessionDate,iex20};
 }
 const estimate=last.value*quote.price;
 if(!Number.isFinite(estimate)||estimate<=0){notes.push('Share-price multiplication overflowed or was invalid.');return {...base,shares,priceDate:quote.sessionDate,iex20}}
 notes.push('Indicative equity value uses SEC DEI shares as of '+last.end+' and a completed Alpaca IEX close as of '+quote.sessionDate+'. Different observation dates can distort this estimate.');
 notes.push('One-company DEI count does not prove all share classes, current float, ADR conversion or corporate-action alignment. '+(quote.splitValidation==='verified'?'Price split adjustment is marked verified by provider metadata; issuer capital structure still needs reconciliation.':'Post-filing share splits and raw price/count compatibility remain unverified.'));
 notes.push('No current market cap, enterprise value, or investment valuation has passed the ATLAS evidence gate.');
 return {status:'indicative',estimate,shares,priceDate:quote.sessionDate,iex20,notes,source:company.source};
}
