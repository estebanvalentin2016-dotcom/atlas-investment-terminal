import {useMemo,useState} from 'react';
import {annualPeFromSec,defaultRankWeights,rankCompanies,type RankWeights,type SecCompany,type AnnualPe,type MarketValuationClose} from './ranking-model';
import {PP_AND_E_FCF_DISCLOSURE} from './financial-methodology-eligibility';
const factors:{key:keyof RankWeights;label:string;help:string}[]=[
 {key:'growth',label:'Revenue growth',help:'Latest reported FY versus the preceding FY'},
 {key:'fcf',label:'Free cash flow margin',help:'(Operating cash flow − capital expenditure) ÷ sales'},
 {key:'profit',label:'Net profit margin',help:'Annual net income ÷ annual sales'},
 {key:'pe',label:'P/E valuation',help:'Automatic price / SEC annual diluted EPS; N/A for missing, stale or nonpositive EPS'}
];
const displayPct=(n:number|null)=>n===null?'N/A':(n>0?'+':'')+n.toFixed(1)+'%';
const fmt=(n:number|null)=>n===null?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
export default function InvestmentRankings(){
 const [universe,setUniverse]=useState('BLK, NVDA, CRWD, RKLB, MS');
 const [weights,setWeights]=useState<RankWeights>(defaultRankWeights);
 const [data,setData]=useState<SecCompany[]>([]);
 const [annualPe,setAnnualPe]=useState<Record<string,AnnualPe>>({});
 const [errors,setErrors]=useState<{ticker:string;reason:string}[]>([]);
 const [progress,setProgress]=useState('');
 const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const pe=useMemo(()=>Object.fromEntries(Object.entries(annualPe).map(([t,v])=>[t,v.pe])),[annualPe]);
 const scores=useMemo(()=>rankCompanies(data,weights,pe),[data,weights,pe]);
 const ranked=scores.filter(x=>x.score!==null);
 const total=Object.values(weights).reduce((a,b)=>a+b,0);
 async function run(){
  if(busy)return;
  setBusy(true);setLoaded(false);setData([]);setErrors([]);setAnnualPe({});
  const tickers=[...new Set(universe.toUpperCase().split(/[\s,;]+/).filter(Boolean))];
  if(!tickers.length||tickers.length>8||tickers.some(x=>!/^[A-Z0-9.-]{1,12}$/.test(x))){setProgress('Enter 1–8 valid tickers, separated by commas.');setBusy(false);return}
  const found:SecCompany[]=[],failed:{ticker:string;reason:string}[]=[];
  for(let i=0;i<tickers.length;i++){
   const ticker=tickers[i];setProgress('Fetching real SEC filings: '+(i+1)+' of '+tickers.length+' ('+ticker+')');
   try{
    const response=await fetch('/api/sec/company?ticker='+encodeURIComponent(ticker));
    const body=await response.json() as SecCompany&{error?:string};
    if(!response.ok)throw Error(body.error||'No SEC company data returned');
    if(!body.source?.startsWith('https://data.sec.gov/')||!Array.isArray(body.metrics))throw Error('Unexpected SEC source response');
    found.push(body);
    // No manual P/E and no made-up fallback valuation.
    try{
     const valuation=await fetch('/api/market/valuation-close?ticker='+encodeURIComponent(ticker));
     const quote=await valuation.json() as MarketValuationClose&{error?:string};
     if(!valuation.ok)throw Error(quote.error||'Completed stock close unavailable');
     setAnnualPe(previous=>({...previous,[ticker]:annualPeFromSec(body,quote)}));
    }catch(e){setAnnualPe(previous=>({...previous,[ticker]:{pe:null,eps:null,epsEnd:null,priceDate:null,reason:e instanceof Error?e.message:'IEX valuation close unavailable'}}))}

   }catch(e){failed.push({ticker,reason:e instanceof Error?e.message:'Data unavailable'})}
  }
  setData(found);setErrors(failed);setLoaded(true);setBusy(false);
  setProgress('Loaded '+found.length+' of '+tickers.length+' companies from SEC. Adjust the weights below to re-rank.');
 }
 return <section className="atlas-ranking-workbench">
  <div className="atlas-ranking-head"><h3>Find your top research candidates</h3><p><strong>Choose a shortlist. Set what matters. See the ranking.</strong> This is a preliminary research model, not an empirically tested prediction of returns.</p></div>
  <div className="atlas-ranking-controls">
   <label>Companies to compare (up to 8) <input value={universe} onChange={e=>setUniverse(e.target.value)} placeholder="BLK, NVDA, CRWD" aria-label="Ticker shortlist" /></label>
   <button type="button" className="button primary" disabled={busy} onClick={()=>void run()}>{busy?'Fetching SEC figures…':'Rank these companies'}</button>
  </div>
  <p className="chart-note">The starting tickers are <strong>examples, not recommendations</strong>. ATLAS retrieves real SEC annual figures only when you press the button.</p>
  <div className="atlas-ranking-weights">
   {factors.map(f=><label key={f.key}><span><strong>{f.label}</strong><em>{weights[f.key]}%</em></span><input type="range" min={0} max={60} step={5} value={weights[f.key]} onChange={e=>setWeights(w=>({...w,[f.key]:Number(e.target.value)}))}/><small>{f.help}</small></label>)}
  </div>
  <p className="chart-note"><strong>Total weight:</strong> {total} points (ATLAS normalizes automatically). <strong>Unknown data earns no points.</strong> The thresholds are illustrative research heuristics, not backtested.</p>
  {progress&&<p className="atlas-summary-line" role="status">{progress}</p>}
  {errors.length>0&&<details className="atlas-details"><summary>{errors.length} source issue(s)</summary>{errors.map(x=><p key={x.ticker}><strong>{x.ticker}:</strong> {x.reason}</p>)}</details>}
  {loaded&&<div className="atlas-ranking-results">
   <strong>Research priority list</strong>
   {ranked.length===0&&<p className="opportunity-uncertainty"><strong>Not enough verified factors yet.</strong> No company meets the coverage requirements. Try other tickers or check the missing figures.</p>}
   {scores.map(entry=><article className="atlas-ranking-row" key={entry.ticker}>
    <div className="atlas-ranking-row-head"><div><span className="atlas-rank-number">{entry.score===null?'—':'#'+(ranked.findIndex(x=>x.ticker===entry.ticker)+1)}</span><div><strong>{entry.ticker}</strong><p>{entry.name} · fiscal {entry.year??'unknown'} · filed {entry.annualFiled??'unknown'}</p></div></div><div><strong className="atlas-rank-score">{entry.score===null?'Unranked':entry.score+'/100'}</strong><small>{entry.coverage}% weighted coverage</small></div></div>
    <div className="atlas-ranking-metrics">
     <div><span>Revenue growth</span><strong className={entry.metrics.growth!==null?(entry.metrics.growth>=0?'atlas-tone-positive':'atlas-tone-negative'):''}>{displayPct(entry.metrics.growth)}</strong></div>
     <div><span>PP&amp;E-only FCF margin</span><strong className={entry.score!==null&&entry.metrics.fcfMargin!==null?(entry.metrics.fcfMargin>=0?'atlas-tone-positive':'atlas-tone-negative'):''}>{entry.missing.some(item=>item.startsWith('Ordinary-company methodology withheld:'))?'Withheld':displayPct(entry.metrics.fcfMargin)}</strong></div>
     <div><span>Net margin</span><strong>{displayPct(entry.metrics.profitMargin)}</strong></div>
     <div><span>Auto FY P/E</span><strong>{annualPe[entry.ticker]?.pe!==null&&annualPe[entry.ticker]?.pe!==undefined?annualPe[entry.ticker].pe!.toFixed(1)+'×':'N/A'}</strong><small>{annualPe[entry.ticker]?.priceDate||'No price session'} · {annualPe[entry.ticker]?.epsEnd?'EPS FY ended '+annualPe[entry.ticker].epsEnd:'EPS unavailable'}</small></div>
    </div>
    <p><strong>ATLAS-derived PP&amp;E-only FCF:</strong> {entry.missing.some(item=>item.startsWith('Ordinary-company methodology withheld:'))?'Withheld':fmt(entry.metrics.fcf)} · <strong>FY revenue:</strong> {fmt(entry.metrics.revenue)}</p>
    <p className="chart-note">{PP_AND_E_FCF_DISCLOSURE}</p>
    {annualPe[entry.ticker]?.reason&&<p className="chart-note"><strong>FY P/E check:</strong> {annualPe[entry.ticker].reason}</p>}
    {entry.missing.length>0&&<p className="atlas-rank-missing"><strong>Missing:</strong> {entry.missing.join(', ')}</p>}
    <details className="atlas-details"><summary>Why this score? Show data and caveats</summary>
     {entry.reasons.map((reason,j)=><p key={j}>{reason}</p>)}
     <p><strong>Heuristic only.</strong> This score measures selected accounting ratios against simple absolute cutoffs. Automatic P/E uses completed IEX close divided by matching SEC FY diluted EPS, NOT TTM/forward earnings. Split adjustments, sector comparability, and publication timing require verification. Reported annual metrics may lag the market.</p>
     <a href={entry.source} target="_blank" rel="noopener noreferrer">Open SEC company facts ↗</a>
    </details>
   </article>)}
   <p className="chart-note"><strong>What this list is:</strong> a weighted fundamentals research queue. <strong>What it is not:</strong> a tested investment strategy, analyst-consensus surprise, valuation conclusion, or proof of future upside. Debt, share dilution, stock splits, company-specific risks, cash-flow quality, and catalyst timing require further analysis.</p>
  </div>}
 </section>;
}
