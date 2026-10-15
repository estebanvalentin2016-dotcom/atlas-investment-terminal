import {useState} from 'react';
import {assessPriceHistory,type HistoricalBar,type HistoricalPriceResponse,type PriceHistoryAssessment} from './price-history-model';

const percent=(n:number|null)=>n===null?'Unknown':(n>0?'+':'')+n.toFixed(1)+'%';
const dollar=(n:number)=>'$'+n.toFixed(2);
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'));
const elapsed=(a:string,b:string)=>(Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000;

function TrendChart({bars,asOf}:{bars:HistoricalBar[];asOf:string}){
 const [windowYears,setWindowYears]=useState(5);
 const valid=bars.filter(b=>day(b.date)&&b.date<asOf&&Number.isFinite(b.close)&&b.close>0).sort((a,b)=>a.date.localeCompare(b.date));
 const recent=valid.at(-1);
 const selected=windowYears===0||!recent?valid:valid.filter(b=>elapsed(recent.date,b.date)<=windowYears*365.25);
 if(selected.length<2)return <p className="chart-note">Too little completed weekly price history to chart this time window.</p>;
 const W=660,H=194,left=8,right=8,top=12,bottom=14;
 const high=Math.max(...selected.map(x=>x.close)),low=Math.min(...selected.map(x=>x.close));
 const range=high-low||high*0.1||1;
 const x=(i:number)=>left+i*(W-left-right)/Math.max(1,selected.length-1);
 const y=(price:number)=>top+(high+range*0.06-price)/(range*1.12)*(H-top-bottom);
 const points=selected.map((bar,i)=>x(i).toFixed(1)+','+y(bar.close).toFixed(1)).join(' ');
 const rise=selected[selected.length-1].close>=selected[0].close;
 const stroke=rise?'#6fd5a5':'#f29b9b';
 const baseline=y(selected[0].close);
 return <div className="atlas-price-chart">
  <div className="atlas-price-chart-controls" role="group" aria-label="Historical price window">
   {([1,3,5,0] as const).map(n=><button key={n} type="button" aria-pressed={windowYears===n} className={'button secondary atlas-price-range'+(windowYears===n?' atlas-price-range-active':'')} onClick={()=>setWindowYears(n)}>{n===0?'All available':n+'Y'}</button>)}
  </div>
  <svg viewBox={'0 0 '+W+' '+H} role="img" aria-label={'Split-adjusted IEX weekly closing prices from '+selected[0].date+' to '+selected.at(-1)!.date+', starting '+dollar(selected[0].close)+' and ending '+dollar(selected.at(-1)!.close)} preserveAspectRatio="none" className="atlas-price-line">
   <line x1={left} x2={W-right} y1={baseline} y2={baseline} stroke="#71829a" strokeWidth="1" strokeDasharray="4 4" opacity=".7"/>
   <polyline points={points} stroke={stroke} fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
  </svg>
  <div className="atlas-price-chart-caption"><span>{selected[0].date} · {dollar(selected[0].close)}</span><strong>{percent((selected.at(-1)!.close/selected[0].close-1)*100)} in selected window</strong><span>{selected.at(-1)!.date} · {dollar(selected.at(-1)!.close)}</span></div>
 </div>;
}

export default function PriceHistoryPanel({ticker,history,assessment,asOf}:{ticker:string;history:HistoricalPriceResponse|null;assessment?:PriceHistoryAssessment;asOf:string}){
 const e=assessment??assessPriceHistory(history,asOf);
 const usable=e.status==='usable'&&history?.ticker===ticker;
 return <section className="atlas-survival-panel atlas-price-history-panel" aria-label={'Historical price research for '+ticker}>
  <div className="atlas-survival-panel-head"><strong>Historical share-price performance</strong><span>Completed IEX weekly prices · not a return forecast</span></div>
  {usable&&history?<TrendChart bars={history.bars} asOf={asOf}/>:<p className="opportunity-uncertainty"><strong>Price history unavailable for ranking:</strong> {e.assessment}. {e.coverageNote}</p>}
  <div className="atlas-survival-metrics">
   <div><span>1-year price change</span><strong>{percent(usable?e.returns.year1:null)}</strong></div>
   <div><span>3-year price change</span><strong>{percent(usable?e.returns.year3:null)}</strong><small>Annualized: {percent(usable?e.threeYearAnnualized:null)}</small></div>
   <div><span>5-year price change</span><strong>{percent(usable?e.returns.year5:null)}</strong></div>
   <div><span>Since first available price</span><strong>{percent(usable?e.returns.sinceAvailable:null)}</strong><small>Not verified IPO-to-date return</small></div>
  </div>
  <p className="chart-note"><strong>Research signal:</strong> {usable?e.assessment:'Unavailable'}. {usable&&e.trendScore!==null?'Price-trend research score: '+e.trendScore.toFixed(1)+'/100.':''} Source: {history?.provider??'Alpaca unavailable'} {history?.feed??''} · split-adjusted, excluding dividends. {e.coverageNote}</p>
  <p className="chart-note">Observed coverage: {e.firstDate??'unknown'} through {e.latestDate??'unknown'} · 52-week closing-price drawdown: {percent(usable?e.drawdownFrom52WeekHigh:null)}. Historical price appreciation, deterioration or stagnation alone does not establish undervaluation or forecast returns.</p>
 </section>;
}
