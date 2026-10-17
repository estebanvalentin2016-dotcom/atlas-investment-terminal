import {retainPickLeads,type PickLead} from './picks-research';
export const SUMMARY_KEY='atlas.research.summaries.v1';
export type ResearchSummary={ticker:string;createdAt:string;headline:string;finding:string;action:string;source:string;verdict:'INSUFFICIENT EVIDENCE'};
export type SavedThesis={ticker:string;createdAt:string;thesis:string;invalidation:string;verdict:string};
export type StorageReader=Pick<Storage,'getItem'>;
const dateOk=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const secSource=(value:unknown)=>{try{const url=new URL(String(value));return url.protocol==='https:'&&url.hostname==='data.sec.gov'&&url.pathname.startsWith('/api/xbrl/companyfacts/')}catch{return false}};
export function readList(storage:StorageReader,key:string):unknown[]{
 const raw=storage.getItem(key);if(raw===null)return [];
 const value:unknown=JSON.parse(raw);if(!Array.isArray(value))throw Error('Saved list has an unsupported format');return value;
}
export function readResearchContext(storage:StorageReader){
 const issues:string[]=[];
 const list=(key:string)=>{try{return readList(storage,key)}catch{issues.push('Some saved research could not be read. Existing records were kept.');return []}};
 const summaries=list(SUMMARY_KEY).filter((x):x is ResearchSummary=>{
  const v=x as ResearchSummary;return !!v&&typeof v.ticker==='string'&&dateOk(v.createdAt)&&typeof v.headline==='string'&&typeof v.finding==='string'&&secSource(v.source)&&v.verdict==='INSUFFICIENT EVIDENCE';
 });
 const theses=list('atlas.conviction.theses.v1').filter((x):x is SavedThesis=>{
  const v=x as SavedThesis;return !!v&&typeof v.ticker==='string'&&dateOk(v.createdAt)&&typeof v.thesis==='string'&&typeof v.invalidation==='string';
 });
 const filings=list('atlas.monthly.sec-ledger.v1') as PickLead[];
 return {summaries,theses,filings,issues};
}
export function latestResearch(ticker:string,summaries:ResearchSummary[],theses:SavedThesis[],now=new Date().toISOString()){
 const valid=(createdAt:string)=>Date.parse(createdAt)<=Date.parse(now);
 const snapshot=summaries.filter(x=>x.ticker===ticker&&valid(x.createdAt)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
 const thesis=theses.filter(x=>x.ticker===ticker&&valid(x.createdAt)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
 if(thesis&&(!snapshot||Date.parse(thesis.createdAt)>=Date.parse(snapshot.createdAt)))return {kind:'Saved thesis draft',date:thesis.createdAt,headline:'User-saved research · not independently verified',text:thesis.thesis,source:null,verdict:'Insufficient Evidence'};
 if(snapshot)return {kind:'Saved research conclusion',date:snapshot.createdAt,headline:snapshot.headline,text:snapshot.finding,source:snapshot.source,verdict:'Insufficient Evidence'};
 return null;
}
export function savedDevelopments(ticker:string,filings:PickLead[],asOf:string){
 return retainPickLeads([],filings.filter(x=>x?.ticker===ticker),asOf).filter(x=>{
  const path=new URL(x.url).pathname;return !path.includes('..')&&/^\/Archives\/edgar\/data\/\d+\/[\d-]+\.txt$/.test(path);
 }).slice(0,2);
}
export function saveResearchSummary(storage:Pick<Storage,'getItem'|'setItem'>,summary:ResearchSummary){
 // Do not replace unreadable historical data when storage is corrupted or disabled.
 const existing=readList(storage,SUMMARY_KEY);
 storage.setItem(SUMMARY_KEY,JSON.stringify([...existing,summary].slice(-200)));
}
