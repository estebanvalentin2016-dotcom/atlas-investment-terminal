import {useState} from 'react';
// @ts-ignore JavaScript-only alignment helper.
import {easternClock,eventStudy} from './event-study.mjs';
// @ts-ignore JavaScript-only eligible-event filter.
import {comparableFilings} from './event-comparison.mjs';
type Filing={form:string;date:string;acceptedAt:string|null;items:string;labels:string[];url:string;accession:string};
type Row={filing:Filing;initial:number|null;after3:number|null;after5:number|null;status:string};
const fmt=(v:number|null)=>v===null?'N/A':(v>=0?'+':'')+v.toFixed(2)+'%';
const cls=(v:number|null)=>v===null?'event-unavailable':v>0?'event-positive':v<0?'event-negative':'event-flat';
export default function EventComparison({ticker,filings}:{ticker:string;filings:Filing[]}){
 const [rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const eligible=comparableFilings(filings) as Filing[];
 async function compare(){
  setBusy(true);setRows([]);setProgress('');
  const completed:Row[]=[];
  for(const filing of eligible){
   setProgress('Checking '+(completed.length+1)+' of '+eligible.length+' recent filings…');
   const row:Row={filing,initial:null,after3:null,after5:null,status:'Unavailable'};
   try{
    const eventDate=easternClock(filing.acceptedAt)?.date;
    if(!eventDate)throw Error('Acceptance date missing');
    const query=new URLSearchParams({ticker,eventDate});
    const response=await fetch('/api/market/event?'+query);
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Market data unavailable');
    if(result.feed!=='IEX'||result.adjustment!=='split'||!result.completedSessionsOnly||result.partialHistory)throw Error('Incomplete or unsuitable market history');
    const study=eventStudy(filing.acceptedAt,result.bars);
    if(study.status!=='aligned')throw Error(study.reason||'Could not align event');
    row.initial=study.returns.day1??null;
    row.after3=study.continuation?.day3??null;
    row.after5=study.continuation?.day5??null;
    row.status='Measured';
   }catch(e){row.status=e instanceof Error?e.message:'Unavailable'}
   completed.push(row);setRows([...completed]);
  }
  setBusy(false);setProgress('Comparison completed');
 }
 return <section className="event-comparison">
  <h3>Historical event comparison</h3>
  <p className="chart-note">Compare up to three recent SEC filings for {ticker}. Initial reaction is measured from the pre-event close; continuation starts from the first eligible session close. Requests run sequentially using split-adjusted IEX prices. This is not a backtest.</p>
  <button type="button" className="button" disabled={busy||eligible.length===0} onClick={compare}>{busy?'Comparing filings…':'Compare recent filings ('+eligible.length+')'}</button>
  {eligible.length===0&&<p className="chart-note">No filings fall within the currently supported recent event-data window.</p>}
  {progress&&<p role="status" className="chart-note">{progress}</p>}
  {rows.length>0&&<div className="compare-scroller"><table className="compare-table"><thead><tr><th>SEC filing</th><th>Initial session</th><th>After session 3</th><th>After session 5</th><th>Data status</th></tr></thead><tbody>{rows.map(row=><tr key={row.filing.accession}><td><a href={row.filing.url} target="_blank" rel="noopener noreferrer">{row.filing.date} · {row.filing.labels[0]||'8-K'}</a></td><td><strong className={cls(row.initial)}>{fmt(row.initial)}</strong></td><td><strong className={cls(row.after3)}>{fmt(row.after3)}</strong></td><td><strong className={cls(row.after5)}>{fmt(row.after5)}</strong></td><td>{row.status}</td></tr>)}</tbody></table></div>}
  <p className="chart-note">These are independent descriptive event windows. Small samples, single-exchange prices, other contemporaneous news and prior public announcements limit conclusions. N/A is not treated as a zero return.</p>
 </section>;
}
