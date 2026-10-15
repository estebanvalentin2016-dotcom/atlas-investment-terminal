import {useEffect,useState} from 'react';
type Lead={ticker:string;name:string;form:string;filed:string|null;discoveredOn?:string;url:string;kind:string};
type IndexAudit={records:number;eightKRows:number;validEightKPaths:number;tickerMatchedEightK:number;undatedEightK:number;samples:{cik:string;form:string;filedRaw?:string;path:string;mappedTicker:string|null}[]};
type IndexDiagnostic={date:string;bytes:number;matched:number;status:number;contentType?:string;valid:boolean;encoding?:string;firstChars?:string;audit?:IndexAudit};
type FallbackDiagnostic={ticker:string;error?:string;latestFiling?:string|null;latest8K?:string|null;returnedRows?:number;matchingRecent8K?:number};
type Response={rows:Lead[];matchedFilings:number;successfulDays:number;coverageStatus:string;source:string;fallbackChecked:number;fallbackFailed:number;diagnostics:IndexDiagnostic[];fallbackDiagnostics:FallbackDiagnostic[];errorDays:string[];retrievedAt:string;note:string;error?:string};
export default function OpportunityRadar(){
 const [result,setResult]=useState<Response|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 async function scan(){
  setLoading(true);setError('');
  try{
   const r=await fetch('/api/opportunities/sec-wide');
   const data=await r.json() as Response;
   if(!r.ok)throw Error(data.error||'Market-wide SEC feed unavailable');
   setResult(data);
  }catch(e){setResult(null);setError(e instanceof Error?e.message:'SEC-wide discovery failed')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void scan()},[]);
 return <section className="panel real-panel opportunity-radar">
  <div className="panel-head"><div><span className="eyebrow">ATLAS / OPPORTUNITY DISCOVERY</span><h3>SEC catalyst discovery</h3></div><span className="tag">Fresh filing leads · not buy signals</span></div>
  <p className="description">Find recent 8-K disclosures using SEC daily indexes. If market-wide access fails, ATLAS checks a limited, diversified group of companies instead. The fallback cannot establish market-wide coverage. These filing leads still require fundamental and price-reaction assessment.</p>
  <div className="opportunity-toolbar"><strong>{loading?'Retrieving SEC filing indexes…':error?'Scan failed':result?'SEC index retrieval finished':'Waiting for scan'}</strong>{result&&<span>{result.matchedFilings} 8-K filing leads · {result.successfulDays} valid daily indexes{result.fallbackChecked>0?' · '+result.fallbackChecked+' fallback companies checked':''}</span>}<button type="button" className="button" onClick={()=>void scan()} disabled={loading}>{loading?'Scanning…':'Refresh research queue'}</button></div>
  {error&&<p className="real-error" role="alert">{error}</p>}
  {result&&result.errorDays.length>0&&<details className="opportunity-errors"><summary>Partial coverage: {result.errorDays.length} SEC retrieval issue(s)</summary>{result.errorDays.map(e=><p key={e}>{e}</p>)}</details>}
  {result&&<p className="chart-note">Source coverage: <strong>{result.coverageStatus}</strong>. SEC 403 means access is restricted, not zero filings. {result.fallbackChecked>0&&('Fallback: '+result.fallbackChecked+' companies checked; '+result.fallbackFailed+' failed. This is NOT market-wide coverage.')}</p>}
  {result&&<details className="opportunity-errors"><summary>Daily index diagnostics ({result.diagnostics?.length??0} attempted requests)</summary>{result.diagnostics?.map(x=><div key={x.date}>{x.date}: HTTP {x.status} · {x.bytes.toLocaleString()} bytes · {x.contentType||'no content type'} · {x.encoding||'unknown encoding'} · {x.valid?'Valid SEC index':'No usable index'} · {x.matched} matched{x.firstChars&&<span> · First characters: {x.firstChars}</span>}{x.audit&&<div className="chart-note">Index records: {x.audit.records} · Raw 8-K rows: {x.audit.eightKRows} · Valid 8-K paths: {x.audit.validEightKPaths} · Ticker matches: {x.audit.tickerMatchedEightK} · Non-ISO 8-K dates: {x.audit.undatedEightK}{x.audit.samples.map((s,i)=><p key={i}>Sample {i+1}: CIK {s.cik}, {s.form}, raw filing date {s.filedRaw??'not supplied'}, ticker {s.mappedTicker||'unmapped'}, path {s.path}</p>)}</div>}</div>)}</details>}
  {result&&result.fallbackChecked>0&&<details className="opportunity-errors"><summary>Company fallback audit ({result.fallbackChecked} companies; verify source freshness)</summary>{result.fallbackDiagnostics?.map(x=><p key={x.ticker}><strong>{x.ticker}</strong>: {x.error||('latest filing '+(x.latestFiling||'unknown')+' · latest 8-K '+(x.latest8K||'none returned')+' · '+(x.matchingRecent8K??0)+' recent 8-Ks among '+(x.returnedRows??0)+' submission rows')}</p>)}</details>}
  {result&&result.rows.length>0&&<div className="opportunity-list">{result.rows.map(r=><article className="opportunity-candidate" key={r.url}>
   <div className="opportunity-top"><strong>{r.ticker}</strong><span>{r.form} · Awaiting substance review</span></div>
   <h4>{r.name}</h4>
   <p>{r.discoveredOn?'Indexed '+r.discoveredOn+' · Filed '+(r.filed||'date not verified'):'Filed '+(r.filed||'date not verified')+' · Company-submissions source'} · 8-K disclosure</p>
   <p className="opportunity-uncertainty">Bullish catalyst: <strong>Unverified</strong> · Remaining upside: <strong>Unknown</strong> · Entry viability: <strong>Unknown</strong></p>
   <a href={r.url} target="_blank" rel="noopener noreferrer">Read SEC filing ↗</a>
  </article>)}</div>}
  {result&&!result.rows.length&&<p className="chart-note">No recent 8-K leads could be confirmed from the accessible SEC sources. Review the index diagnostics and fallback dates: missing coverage or stale histories can produce an empty list.</p>}
  <p className="chart-note">Displays up to 40 filing leads, sorted by filing date—not expected profit. An empty or partial source feed must not be read as evidence of no opportunities. Daily filings do not contain reliable announcement minutes. There is no live-price check, profitability assessment, background monitoring or Robinhood execution verification in this phase.</p>
 </section>;
}
