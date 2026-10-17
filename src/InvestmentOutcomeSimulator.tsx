import {useEffect,useState} from 'react';
import {calculateConditionalOutcomes,type HorizonMonths} from './conditional-outcomes';
import type {MarketValuationClose} from './ranking-model';
import type {HistoricalPriceResponse} from './price-history-model';
const dollars=(x:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(x);
const percent=(x:number)=>(x>0?'+':'')+x.toFixed(2)+'%';
const easternDate=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const x=Object.fromEntries(p.filter(v=>v.type!=='literal').map(v=>[v.type,v.value]));return x.year+'-'+x.month+'-'+x.day};
export default function InvestmentOutcomeSimulator({ticker}:{ticker:string}){
 const [amount,setAmount]=useState(500);
 const [months,setMonths]=useState<HorizonMonths>(3);
 const [quote,setQuote]=useState<MarketValuationClose|null>(null);
 const [history,setHistory]=useState<HistoricalPriceResponse|null>(null);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false;
  setQuote(null);setHistory(null);setError('');setBusy(true);
  async function load(){
   const endpoints=['/api/market/valuation-close?ticker=','/api/market/long-history?ticker='];
   const results=await Promise.allSettled(endpoints.map(async x=>{const r=await fetch(x+encodeURIComponent(ticker));const data=await r.json();if(!r.ok)throw Error(typeof data?.error==='string'?data.error:'Market source unavailable');return data}));
   if(cancelled)return;
   const q=results[0],h=results[1];const issues:string[]=[];
   if(q.status==='fulfilled'&&q.value.ticker===ticker&&q.value.feed==='IEX'&&q.value.completedSession&&q.value.price>0)setQuote(q.value as MarketValuationClose);
   else issues.push(q.status==='rejected'?String(q.reason):'Completed IEX close failed issuer/price validation');
   if(h.status==='fulfilled'&&h.value.ticker===ticker&&h.value.provider==='Alpaca'&&h.value.feed==='IEX'&&Array.isArray(h.value.bars))setHistory(h.value as HistoricalPriceResponse);
   else issues.push(h.status==='rejected'?String(h.reason):'Historical IEX bars failed issuer validation');
   setError(issues.join(' · '));setBusy(false);
  }
  void load();
  return ()=>{cancelled=true};
 },[ticker]);
 const result=calculateConditionalOutcomes(history,amount,months,easternDate(),quote?.sessionDate??null);
 return <section className="atlas-simulator" aria-label={'Conditional investment amount illustration for '+ticker}>
  <h4>What could {dollars(amount)} turn into?</h4>
  <p className="chart-note">Compare historical price-move scenarios for a hypothetical investment in {ticker}. This is <strong>not</strong> a prediction that these returns will occur or a recommendation to buy.</p>
  <div className="atlas-simulator-controls">
   <label>Investment amount <strong>{dollars(amount)}</strong>
    <input aria-label="Hypothetical investment amount" type="range" min="100" max="5000" step="50" value={amount} onChange={e=>setAmount(Number(e.target.value))}/>
   </label>
   <label>Amount in dollars
    <input aria-label="Enter hypothetical dollar amount" type="number" min="100" max="5000" step="50" value={amount} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))setAmount(Math.min(5000,Math.max(100,n)))}}/>
   </label>
   <label>Illustrative holding period
    <select aria-label="Historical outcome horizon" value={months} onChange={e=>setMonths(Number(e.target.value) as HorizonMonths)}>
     <option value={1}>1 month</option><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option>
    </select>
   </label>
  </div>
  {busy?<p className="chart-note">Retrieving completed IEX price and historical prices…</p>:result.status==='unavailable'?
   <p className="opportunity-uncertainty"><strong>Numerical illustration withheld:</strong> {result.reason} {error&&'Source: '+error}</p>:
   <>
    <p className="chart-note"><strong>Price reference:</strong> {dollars(quote!.price)} · {quote!.sessionDate} completed IEX close. The money figures below apply historical percent moves to {dollars(amount)}, not a forward valuation.</p>
    <div className="atlas-simulator-results">
     {result.bands.map(b=><div key={b.label}><span>{b.label}</span><strong>{dollars(b.endingValue)}</strong><small className={b.profit<0?'atlas-tone-negative':'atlas-tone-positive'}>{b.profit>=0?'+':''}{dollars(b.profit)} · {percent(b.returnPct)}</small></div>)}
     {result.severeStress&&<div><span>Additional −50% loss stress</span><strong>{dollars(result.severeStress.endingValue)}</strong><small className="atlas-tone-negative">{dollars(result.severeStress.profit)} · −50.00%</small></div>}
    </div>
    <p className="chart-note">{result.sampleCount} <strong>overlapping historical windows</strong> from {result.start} through {result.end}; this does not mean {result.sampleCount} independent observations. {result.reason}</p>
   </>}
 </section>;
}
