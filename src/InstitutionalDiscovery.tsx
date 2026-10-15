import {useMemo,useState,type FormEvent} from 'react';
type Change='newly_reported'|'reported_increase'|'reported_decrease'|'no_longer_reported'|'unchanged';
type Position={key:string;cusip:string;issuer:string;className:string;shares:number;valueDollars:number;previousShares:number|null;changeShares:number|null;change:Change;portfolioPct:number|null;rowCount:number};
type Report={accession:string;period:string;filed:string;sourceUrl:string;positions:number;excluded:number};
type ManagerData={cik:string;manager:string;retrievedAt:string;latest:Report;previous:Report;rows:Position[];coverage:{subset:string;latestExcluded:number;previousExcluded:number;reportCompleteness:string}};
const examples=[{name:'TOMS Capital Investment Management',cik:'1743937',type:'Active 13F manager'},{name:'ValueAct Holdings',cik:'1418814',type:'Specialist 13F manager'}];
const labels:Record<Change,string>={newly_reported:'Newly reported',reported_increase:'Reported shares increased',reported_decrease:'Reported shares decreased',no_longer_reported:'No longer reported',unchanged:'No share-count change'};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
const shares=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
const limit=70;
export default function InstitutionalDiscovery(){
 const [managerCik,setManagerCik]=useState('1743937');
 const [loaded,setLoaded]=useState<Record<string,ManagerData>>({});
 const [errors,setErrors]=useState<Record<string,string>>({});
 const [working,setWorking]=useState('');
 const [mode,setMode]=useState<'investor'|'company'>('investor');
 const [active,setActive]=useState('1743937');
 const [term,setTerm]=useState('');
 const [issuer,setIssuer]=useState('');
 const [issuerHint,setIssuerHint]=useState('');
 const [kind,setKind]=useState<Change|'all'>('all');
 const [page,setPage]=useState(1);
 const results=Object.values(loaded);
 async function load(cik:string){
  if(working)return;
  if(!/^\d{1,10}$/.test(cik)||Number(cik)<1){setErrors(prev=>({...prev,[cik]:'Enter a valid SEC manager CIK (1–10 digits).'}));return}
  const normalized=String(Number(cik));
  setWorking(normalized);setActive(normalized);setErrors(prev=>({...prev,[normalized]:''}));
  try{
   const response=await fetch('/api/institutions/managers?cik='+encodeURIComponent(normalized));
   const body=await response.json() as ManagerData&{error?:string};
   if(!response.ok||!Array.isArray(body.rows)||!body.latest?.sourceUrl)throw Error(body.error||'No verified 13F records returned');
   setLoaded(prev=>({...prev,[normalized]:body}));
   setPage(1);
  }catch(e){setErrors(prev=>({...prev,[normalized]:e instanceof Error?e.message:'SEC manager data unavailable'}))}
  finally{setWorking('')}
 }
 function searchManager(e:FormEvent){e.preventDefault();void load(managerCik)}
 async function searchIssuer(e:FormEvent){
  e.preventDefault();const q=issuer.trim();
  setTerm(q);setIssuerHint('');setPage(1);
  if(!/^[A-Z0-9.-]{1,12}$/i.test(q))return;
  try{
   const response=await fetch('/api/sec/search?q='+encodeURIComponent(q));
   if(!response.ok)return;
   const data=await response.json() as {items:{name:string;ticker:string}[]};
   const match=data.items?.find(x=>x.ticker.toUpperCase()===q.toUpperCase());
   if(match){setTerm(match.name);setIssuerHint('Ticker resolved through the SEC company index. Matching to 13F issuer names is approximate—not a verified CUSIP-to-ticker mapping. Confirm the security in the original filing.')}
  }catch{setIssuerHint('Ticker-to-issuer lookup unavailable. Search the full issuer name or CUSIP instead.')}
 }
 const activeManager=loaded[active]||null;
 const combined=useMemo(()=>{
  if(mode==='investor')return activeManager?.rows.map(row=>({...row,manager:activeManager.manager,cik:activeManager.cik,period:activeManager.latest.period,filed:activeManager.latest.filed,source:activeManager.latest.sourceUrl,previousSource:activeManager.previous.sourceUrl}))||[];
  return results.flatMap(manager=>manager.rows.map(row=>({...row,manager:manager.manager,cik:manager.cik,period:manager.latest.period,filed:manager.latest.filed,source:manager.latest.sourceUrl,previousSource:manager.previous.sourceUrl})));
 },[mode,activeManager,loaded]);
 const visible=combined.filter(row=>(kind==='all'||row.change===kind)&&(!term||(row.issuer+' '+row.cusip+' '+row.className).toLowerCase().includes(term.toLowerCase()))).sort((a,b)=>(b.valueDollars-a.valueDollars));
 const current=visible.slice((page-1)*limit,page*limit),pages=Math.max(1,Math.ceil(visible.length/limit));
 const overview=combined.reduce((m,row)=>{m[row.change]++;return m}, {newly_reported:0,reported_increase:0,reported_decrease:0,no_longer_reported:0,unchanged:0} as Record<Change,number>);
 function setModeSafe(next:'investor'|'company'){setMode(next);setPage(1);setKind('all');setTerm('');setIssuerHint('')}
 return <section className="panel real-panel atlas-institutions">
  <div className="panel-head"><div><span className="eyebrow">INSTITUTIONAL DISCOVERY / SEC FORM 13F</span><h3>Where are institutions reporting positions?</h3></div><span className="tag">Quarter-end snapshots · not trade confirmations</span></div>
  <p className="description"><strong>Track the shares sophisticated managers report owning.</strong> Compare their last two available quarters and investigate the actual company—without guessing why the investor bought it.</p>
  <div className="atlas-investor-tabs">
   <button type="button" className={mode==='investor'?'button primary':'button secondary'} onClick={()=>setModeSafe('investor')}>Investor → Companies</button>
   <button type="button" className={mode==='company'?'button primary':'button secondary'} onClick={()=>setModeSafe('company')}>Company → Investors</button>
  </div>
  <div className="atlas-institution-controls">
   <strong>Load publicly disclosed managers</strong>
   <div className="atlas-institution-presets">{examples.map(example=><button type="button" className="button secondary" key={example.cik} disabled={Boolean(working)} onClick={()=>{setManagerCik(example.cik);void load(example.cik)}}>{example.name} ↗</button>)}</div>
   <form className="atlas-ranking-controls" onSubmit={searchManager}><label>Or use a manager's SEC CIK<input value={managerCik} onChange={e=>setManagerCik(e.target.value)} pattern="[0-9]{1,10}" aria-label="Reporting manager CIK" placeholder="SEC reporting manager CIK"/></label><button className="button primary" disabled={Boolean(working)} type="submit">{working?'Checking SEC filings…':'Load manager 13F'}</button></form>
   <p className="chart-note"><strong>These managers are examples, not recommendations.</strong> SEC 13F does not cover every position or investment. The app only knows the managers you explicitly load here.</p>
   {Object.entries(errors).filter(([,value])=>Boolean(value)).map(([key,value])=><p className="opportunity-uncertainty" key={key}><strong>CIK {key}:</strong> {value}</p>)}
  </div>
  {results.length>0&&<div className="atlas-institution-results">
   {mode==='investor'?<>
    <label className="atlas-institution-select">Reporting manager<select value={active} onChange={e=>{setActive(e.target.value);setPage(1)}}>{results.map(data=><option value={data.cik} key={data.cik}>{data.manager} · CIK {data.cik}</option>)}</select></label>
    {activeManager&&<div className="atlas-institution-sources"><strong>{activeManager.manager}</strong><p><strong>Latest quarter ended:</strong> {activeManager.latest.period} · filed {activeManager.latest.filed}</p><p><strong>Previous quarter ended:</strong> {activeManager.previous.period} · filed {activeManager.previous.filed}</p><p>Primary sources: <a href={activeManager.latest.sourceUrl} target="_blank" rel="noopener noreferrer">Latest SEC 13F table ↗</a> · <a href={activeManager.previous.sourceUrl} target="_blank" rel="noopener noreferrer">Previous SEC 13F table ↗</a></p><small>{activeManager.coverage.subset}. Excluded rows (latest): {activeManager.coverage.latestExcluded}. Values are original SEC dollar figures, not thousands.</small></div>}
   </>:<>
    <strong>Company → Investors across {results.length} loaded manager{results.length===1?'':'s'}</strong>
    <form className="atlas-ranking-controls" onSubmit={searchIssuer}><label>Company name, ticker or CUSIP<input value={issuer} onChange={e=>setIssuer(e.target.value)} aria-label="Search company institutional positions" placeholder="Apple, AAPL, 037833100"/></label><button className="button primary" type="submit">Find disclosed investors</button></form>
    {issuerHint&&<p className="opportunity-uncertainty">{issuerHint}</p>}
    <p className="chart-note"><strong>Coverage:</strong> only institutions you loaded. Finding zero rows is not evidence that institutions do not own the company. Names must be checked against SEC-issued security identifiers.</p>
   </>}
   <div className="atlas-institution-stats">
    <div><span>Newly reported</span><strong>{overview.newly_reported}</strong></div>
    <div><span>Share increases</span><strong>{overview.reported_increase}</strong></div>
    <div><span>Share decreases</span><strong>{overview.reported_decrease}</strong></div>
    <div><span>No longer reported</span><strong>{overview.no_longer_reported}</strong></div>
   </div>
   {mode==='investor'&&<label className="atlas-institution-select">Find an issuer or CUSIP<input value={term} onChange={e=>{setTerm(e.target.value);setPage(1)}} placeholder="Search within this manager"/></label>}
   <label className="atlas-institution-select">Position changes<select value={kind} onChange={e=>{setKind(e.target.value as Change|'all');setPage(1)}}><option value="all">All ordinary share positions</option>{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <p className="atlas-summary-line"><strong>{visible.length} reported securities</strong> match these filters. Share-count changes can reflect transactions, splits, corporate actions, manager structures or reporting corrections—<strong>not dated purchases.</strong></p>
   <div className="atlas-institution-list">
    {current.map(row=><article className="atlas-institution-row" key={row.cik+'-'+row.key}>
     <div className="atlas-institution-row-head"><div><strong>{row.issuer}</strong><span>{row.className} · CUSIP {row.cusip}</span></div><span className={row.change==='reported_increase'||row.change==='newly_reported'?'atlas-tone-positive':row.change==='reported_decrease'||row.change==='no_longer_reported'?'atlas-tone-negative':'atlas-tone-neutral'}>{labels[row.change]}</span></div>
     <div className="atlas-institution-values"><div><span>Latest reported shares</span><strong>{shares(row.shares)}</strong></div><div><span>Prior reported shares</span><strong>{row.previousShares===null?'Not reported':shares(row.previousShares)}</strong></div><div><span>Change in reported shares</span><strong>{row.changeShares===null?'Newly reported':(row.changeShares>0?'+':'')+shares(row.changeShares)}</strong></div><div><span>Reported position value</span><strong>{money(row.valueDollars)}</strong></div></div>
     <p className="chart-note"><strong>{row.manager}</strong> · quarter {row.period} · filed {row.filed}. {row.portfolioPct===null?'Share of analyzed ordinary-share positions unavailable.':row.portfolioPct.toFixed(2)+'% of analyzed ordinary-share position value (not whole manager AUM).'}</p>
     <details className="atlas-details"><summary>SEC sources and investment rationale</summary>
      <p>Current quarter: <a href={row.source} target="_blank" rel="noopener noreferrer">SEC 13F information table ↗</a> · previous: <a href={row.previousSource} target="_blank" rel="noopener noreferrer">SEC preceding quarter ↗</a></p>
      <p><strong>Investor-stated rationale:</strong> Not publicly verified in ATLAS. We have not established why this institution holds the security.</p>
      <p><strong>ATLAS inferred rationale:</strong> Not assessed. Evaluate company filings, earnings and existing catalyst evidence separately.</p>
      <p><strong>Ownership caveat:</strong> CUSIP and security class identify the reported security. A reported share increase is not proof of a purchase on any specific date, and 13F does not reveal most private holdings.</p>
     </details>
    </article>)}
   </div>
   {!visible.length&&<p className="opportunity-uncertainty"><strong>No verified matching records in loaded manager reports.</strong> Broaden the issuer search or load additional managers; this isn't a market-wide no-ownership finding.</p>}
   {pages>1&&<div className="atlas-institution-pagination"><button className="button secondary" type="button" disabled={page<=1} onClick={()=>setPage(x=>x-1)}>Previous</button><strong>{page} / {pages}</strong><button className="button secondary" type="button" disabled={page>=pages} onClick={()=>setPage(x=>x+1)}>Next</button></div>}
   <details className="atlas-details"><summary>Data coverage, delays and interpretation rules</summary><p>Quarter-end holdings may be filed weeks later; amounts are snapshots, not dated orders. A report may omit confidential positions, smaller equity stakes outside 13F, private holdings and excluded types such as options, bonds and principal amounts.</p><p>ATLAS compares only completed ordinary-share tables with exact CUSIP/class and blocks ambiguous amendment or 13F notice periods. It does not automatically reconcile stock splits, renamed share classes, affiliated manager overlaps, or disputed issuer-ticker identity.</p><p>Passive and active management must be distinguished using validated manager metadata, not a share-count increase alone. Multiple manager interest is not independently verified institutional consensus unless entities are checked for affiliation.</p></details>
  </div>}
 </section>;
}
