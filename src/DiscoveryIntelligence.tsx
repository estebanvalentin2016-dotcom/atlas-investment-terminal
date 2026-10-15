import {useState,type FormEvent} from 'react';
import {fiveSessionRelative,type MomentumObservation} from './topic-market';
import type {PriceBar} from './filing-price-context';
type NewsItem={title:string;link:string;source:string;feedPublishedAt:string|null;feedDateOnly?:string|null;feedDateRaw?:string};
type TopicResponse={query:string;provider:string;retrievedAt:string;items:NewsItem[];coverage:string;note:string;error?:string};
type MarketResponse={ticker:string;bars:PriceBar[];feed:string;completedSessionsOnly:boolean;error?:string};
const etfs=[{ticker:'XLK',name:'Technology'},{ticker:'XLF',name:'Financials'},{ticker:'XLV',name:'Health care'},{ticker:'XLE',name:'Energy'},{ticker:'XLI',name:'Industrials'},{ticker:'XLY',name:'Consumer discretionary'}];
const pct=(n:number|null)=>n===null?'N/A':(n>0?'+':'')+n.toFixed(2)+'%';
const asOfNY=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const d=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return d.year+'-'+d.month+'-'+d.day};
async function bars(ticker:string,date:string){
 const r=await fetch('/api/market/event?ticker='+encodeURIComponent(ticker)+'&eventDate='+date);
 const data=await r.json() as MarketResponse;
 if(!r.ok||data.feed!=='IEX'||data.completedSessionsOnly!==true||!Array.isArray(data.bars))throw Error(data.error||'Completed IEX history unavailable');
 return data.bars;
}
export default function DiscoveryIntelligence(){
 const [keyword,setKeyword]=useState('photonic computing');
 const [custom,setCustom]=useState('NVDA, CRWD, RKLB');
 const [news,setNews]=useState<TopicResponse|null>(null),[newsError,setNewsError]=useState('');
 const [searching,setSearching]=useState(false);
 const [running,setRunning]=useState(false),[progress,setProgress]=useState('');
 const [ranked,setRanked]=useState<{ticker:string;name:string;value:MomentumObservation}[]>([]);
 const [marketErrors,setMarketErrors]=useState<string[]>([]);
 async function search(e:FormEvent){e.preventDefault();setSearching(true);setNews(null);setNewsError('');
  try{
   const r=await fetch('/api/discovery/topic-news?q='+encodeURIComponent(keyword.trim()));
   const body=await r.json() as TopicResponse;
   if(!r.ok)throw Error(body.error||'Keyword news unavailable');
   setNews(body);
  }catch(e){setNewsError(e instanceof Error?e.message:'Keyword news unavailable')}
  finally{setSearching(false)}
 }
 async function compare(){
  if(running)return;
  const customTickers=[...new Set(custom.toUpperCase().split(/[\s,;]+/).filter(Boolean))];
  if(customTickers.length>6||customTickers.some(t=>!/^[A-Z0-9.-]{1,12}$/.test(t))){setMarketErrors(['Enter no more than six valid company tickers.']);return}
  setRunning(true);setMarketErrors([]);setRanked([]);
  const date=asOfNY();
  const items=[...etfs,...customTickers.filter(t=>!etfs.some(e=>e.ticker===t)&&t!=='SPY').map(t=>({ticker:t,name:'Selected ticker'}))];
  const errors:string[]=[],result:{ticker:string;name:string;value:MomentumObservation}[]=[];
  try{
   setProgress('Retrieving reference SPY history…');
   const benchmark=await bars('SPY',date);
   for(let i=0;i<items.length;i++){
    const item=items[i];setProgress('Checking completed IEX sessions: '+(i+1)+' / '+items.length+' · '+item.ticker);
    try{
     const primary=await bars(item.ticker,date);
     result.push({...item,value:fiveSessionRelative(item.ticker,primary,benchmark)});
    }catch(e){errors.push(item.ticker+': '+(e instanceof Error?e.message:'Price unavailable'))}
   }
  }catch(e){errors.push('SPY benchmark: '+(e instanceof Error?e.message:'Unavailable'))}
  setRanked(result.sort((a,b)=>(b.value.relative5??-999)-(a.value.relative5??-999)));
  setMarketErrors(errors);setRunning(false);setProgress('Finished. These are momentum comparisons, not industry fundamentals or news-driven predictions.');
 }
 return <section className="panel real-panel atlas-topic-lab">
  <div className="panel-head"><div><span className="eyebrow">DISCOVERY INTELLIGENCE / PUBLIC NEWS + IEX</span><h3>Research where attention and momentum are building</h3></div><span className="tag">On-demand evidence, not bullish forecasts</span></div>
  <p className="description"><strong>Search a topic.</strong> Then independently compare sector ETFs and your selected stocks against SPY. News coverage and rising prices are different pieces of evidence.</p>
  <form className="atlas-ranking-controls" onSubmit={search}><label>Search a news keyword<input value={keyword} onChange={e=>setKeyword(e.target.value)} minLength={3} maxLength={100} required placeholder="AI chips, FDA approval, quantum computers"/></label><button className="button primary" type="submit" disabled={searching}>{searching?'Searching news…':'Search topic news'}</button></form>
  {newsError&&<p className="real-error">{newsError}</p>}
  {news&&<div className="atlas-topic-news"><h4>Recent Google News coverage: {news.items.length} source candidates</h4>
   <p className="chart-note">This is only the up-to-10-item RSS sample, <strong>not all relevant coverage or a sentiment score</strong>. Google RSS timestamps are not verified original publisher times.</p>
   {news.items.map((article,i)=><article key={article.link+i}><a href={article.link} target="_blank" rel="noopener noreferrer">{article.title}</a><p><strong>{article.source||'Unknown source'}</strong> · {article.feedPublishedAt?'Google feed: '+new Date(article.feedPublishedAt).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'}):article.feedDateOnly?'Date only: '+article.feedDateOnly:'Publication clock unknown'}</p></article>)}
  </div>}
  <div className="atlas-ranking-controls"><label>Stocks to compare alongside sector ETFs (up to 6 tickers)<input value={custom} onChange={e=>setCustom(e.target.value)} aria-label="Custom ticker comparison" placeholder="NVDA, CRWD"/></label><button type="button" className="button primary" disabled={running} onClick={()=>void compare()}>{running?'Comparing completed sessions…':'Compare sector and stock momentum'}</button></div>
  <p className="chart-note"><strong>Six sector ETF proxies:</strong> Technology (XLK), Financials (XLF), Health care (XLV), Energy (XLE), Industrials (XLI), Consumer discretionary (XLY). This is a limited subset of sectors and does not prove why prices moved.</p>
  {progress&&<p role="status" className="atlas-summary-line">{progress}</p>}
  {marketErrors.length>0&&<details className="atlas-details"><summary>Unavailable market sources ({marketErrors.length})</summary>{marketErrors.map((error,i)=><p key={i}>{error}</p>)}</details>}
  {ranked.length>0&&<div className="atlas-topic-ranked"><h4>Five-session relative momentum · strongest first</h4>
   {ranked.map((item,i)=><div key={item.ticker} className="atlas-topic-row"><div><strong>{item.ticker}</strong><span>{item.name}</span></div><div><strong className={item.value.relative5===null?'atlas-tone-neutral':item.value.relative5>=0?'atlas-tone-positive':'atlas-tone-negative'}>{pct(item.value.relative5)} vs SPY</strong><small>Stock/ETF {pct(item.value.return5)} · SPY {pct(item.value.spyReturn5)} · {item.value.asOf||'Date unknown'}</small></div></div>)}
   <p className="chart-note"><strong>Research direction only:</strong> A high 5-session return is not an entry signal or proof of remaining upside. Topic news results are not causally linked to these returns. IEX data can differ from consolidated prices.</p>
  </div>}
 </section>;
}
