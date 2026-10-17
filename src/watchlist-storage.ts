export const WATCH_KEY='atlas.real.watch.v1', NOTES_KEY='atlas.real.notes.v1';
export type CompanyEntry={ticker:string;name:string;cik?:number};
export function readWorkspaceStorage(storage:Pick<Storage,'getItem'>){
 const blocked:string[]=[],issues:string[]=[];
 function read<T>(key:string,fallback:T,valid:(value:unknown)=>boolean):T{
  try{const raw=storage.getItem(key);if(raw===null)return fallback;const value:unknown=JSON.parse(raw);if(!valid(value))throw Error('Unsupported format');return value as T}
  catch{blocked.push(key);issues.push('Saved '+(key===WATCH_KEY?'companies':'notes')+' could not be read. Existing records were kept; editing this data is disabled.');return fallback}
 }
 const watch=read<CompanyEntry[]>(WATCH_KEY,[],value=>Array.isArray(value)&&value.every(x=>x&&typeof x.ticker==='string'&&/^[A-Z0-9.-]{1,12}$/.test(x.ticker)&&typeof x.name==='string'));
 const notes=read<Record<string,string>>(NOTES_KEY,{},value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(x=>typeof x==='string'));
 return {watch,notes,blocked,issues};
}
export function removeSavedCompany(watch:CompanyEntry[],ticker:string){return watch.filter(entry=>entry.ticker!==ticker)}
export function selectComparison(selected:string[],ticker:string){return selected.includes(ticker)?selected.filter(x=>x!==ticker):selected.length>=2?[selected[1],ticker]:[...selected,ticker]}
