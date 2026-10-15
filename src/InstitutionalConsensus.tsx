import {useMemo,useState,type FormEvent} from 'react';
import {FUND_SOURCE_STATUS,consensusFromReports,reportingRecordsFrom13F,type InstitutionRecord} from './institutional-consensus';
type Report={period:string;filed:string;sourceUrl:string};
type Position={key:string;cusip:string;issuer:string;className:string;shares:number;previousShares:number|null;portfolioPct:number|null;change:InstitutionRecord['change']};
type ManagerResponse={cik:string;manager:string;latest:Report;previous:Report;rows:Position[];error?:string};
const count=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:0});
export default function InstitutionalConsensus(){
 const [ciks,setCiks]=useState('1743937, 1418814');
 const [managers,setManagers]=useState<ManagerResponse[]>([]);
 const [errors,setErrors]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState('');
 const [search,setSearch]=useState('');
 const [changedOnly,setChangedOnly]=useState(true);
 const [page,setPage]=useState(1);
 const candidates=useMemo(()=>consensusFromReports(managers.flatMap(reportingRecordsFrom13F)),[managers]);
 const filtered=candidates.filter(c=>(!changedOnly||c.provisionalInterest>0)&&(!search||(c.issuer+' '+c.cusip+' '+c.className).toUpperCase().includes(search.toUpperCase())));
 const shown=filtered.slice((page-1)*35,page*35);
 async function inspect(e:FormEvent){
  e.preventDefault();if(busy)return;
  const input=[...new Set(ciks.split(/[\s,;]+/).filter(Boolean))];
  if(input.length<2||input.length>6||input.some(x=>!/^[0-9]{1,10}$/.test(x)||Number(x)<1)){
   setErrors(['Enter 2–6 distinct SEC reporting-manager CIKs.']);return;
  }
  setBusy(true);setErrors([]);setManagers([]);setPage(1);setProgress('Loading SEC reporting-manager disclosures…');
  const next:ManagerResponse[]=[],failed:string[]=[];
  for(let i=0;i<input.length;i++){
   const cik=input[i];setProgress('Checking SEC 13F reports '+(i+1)+' / '+input.length+' (CIK '+cik+')');
   try{
    const response=await fetch('/api/institutions/managers?cik='+encodeURIComponent(cik));
    const body=await response.json() as ManagerResponse;
    if(!response.ok||!Array.isArray(body.rows)||!body.latest?.sourceUrl)throw Error(body.error||'Incomplete 13F source data');
    next.push(body);
   }catch(e){failed.push('CIK '+cik+': '+(e instanceof Error?e.message:'SEC unavailable'))}
  }
  setManagers(next);setErrors(failed);setBusy(false);setProgress('Loaded '+next.length+' of '+input.length+' reporting managers. Consensus verification requires manager independence and active-mandate evidence.');
 }
 const latestDates=[...new Set(managers.map(x=>x.latest.period))];
 return <section className="panel real-panel atlas-consensus">
  <div className="panel-head"><div><span className="eyebrow">CROSS-INSTITUTIONAL INTELLIGENCE / DISCLOSED HOLDINGS</span><h3>Are independent managers converging on the same companies?</h3></div><span className="tag">No automatic buy ratings</span></div>
  <p className="description"><strong>See overlapping holdings and newly reported share increases.</strong> ATLAS separates <strong>co-reporting</strong> from <strong>verified active-manager consensus</strong>. An increase in reported shares is not a dated purchase.</p>
  <form className="atlas-ranking-controls atlas-consensus-controls" onSubmit={inspect}><label>SEC manager CIKs (2–6, separated by commas)<input aria-label="Consensus manager CIKs" value={ciks} onChange={e=>setCiks(e.target.value)} placeholder="1743937, 1418814"/></label><button className="button primary" type="submit" disabled={busy}>{busy?'Loading SEC filings…':'Analyze institutional overlap'}</button></form>
  <p className="chart-note"><strong>First-stage SEC coverage:</strong> exact CUSIP + share class, two comparable quarter-end reports per loaded manager. A larger universe and fund-level holdings feeds are being added incrementally; examples are not endorsed institutions.</p>
  {progress&&<p className="atlas-summary-line" role="status">{progress}</p>}
  {errors.length>0&&<details className="atlas-details" open><summary>Unavailable manager records ({errors.length})</summary>{errors.map((error,i)=><p key={i}>{error}</p>)}</details>}
  <div className="atlas-consensus-funds">
   <strong>Fund-level disclosure connectors</strong>
   <p className="chart-note">Vanguard, BlackRock/iShares and State Street/SPDR disclose fund holdings on different schedules. ATLAS will store fund, manager, security, holdings date and actual publication date separately—not pretend these adapters already retrieve live fund records.</p>
   <div className="atlas-consensus-fundcards">{FUND_SOURCE_STATUS.map(entry=><div key={entry.provider}><strong>{entry.provider}</strong><span>{entry.status}</span><small>{entry.frequency} · {entry.note}</small></div>)}</div>
  </div>
  {managers.length>0&&<div className="atlas-consensus-results">
   <div className="atlas-consensus-metrics">
    <div><span>13F managers loaded</span><strong>{count(managers.length)}</strong></div>
    <div><span>Security/period groups</span><strong>{count(candidates.length)}</strong></div>
    <div><span>Verified active consensus</span><strong>{count(candidates.filter(x=>x.signal==='verified_active_convergence').length)}</strong></div>
   </div>
   <p className="opportunity-uncertainty"><strong>Do not mistake this for a bullish score.</strong> Raw SEC 13F reports don't establish whether a manager is active, whether two legal managers are affiliated, or why the shares are held. Consequently, <strong>verified active consensus remains unassessed</strong> until those independent disclosures are checked.</p>
   {latestDates.length>1&&<p className="opportunity-uncertainty"><strong>Different reporting dates:</strong> {latestDates.join(', ')}. ATLAS only groups security positions with exactly matching quarter-end dates.</p>}
   <div className="atlas-consensus-filters"><label>Company name or 9-character CUSIP<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Issuer or CUSIP"/></label><label className="atlas-consensus-check"><input type="checkbox" checked={changedOnly} onChange={e=>{setChangedOnly(e.target.checked);setPage(1)}}/> Focus on newly reported or increased share counts</label></div>
   <strong>{filtered.length} issuer/security groups match your filters</strong>
   {shown.map(group=><article className="atlas-consensus-security" key={group.asOfDate+'|'+group.key}>
    <div className="atlas-consensus-header"><div><strong>{group.issuer}</strong><small>{group.className} · CUSIP {group.cusip} · as of {group.asOfDate}</small></div><div><strong>{group.reportedManagers} reporting manager{group.reportedManagers===1?'':'s'}</strong><small>{group.provisionalInterest} new/increased position signal{group.provisionalInterest===1?'':'s'}</small></div></div>
    <p className="atlas-summary-line"><strong>Confirmed independent active buyers:</strong> {group.signal==='verified_active_convergence'?group.verifiedActiveFamilies+' verified families':'Not established'}. <strong>Passive/index and affiliation checks:</strong> not verified by 13F alone.</p>
    <details className="atlas-details"><summary>Inspect manager filings and dates ({group.reporters.length})</summary>
     {group.reporters.map(row=><p key={row.managerCik+'|'+row.key}><strong>{row.managerName}</strong> · {row.change.replaceAll('_',' ')} · current shares {count(row.shares)} · prior shares {row.priorShares===null?'not reported':count(row.priorShares)} · filed {row.publishedDate} · <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Original SEC 13F ↗</a></p>)}
     <p className="chart-note"><strong>Investor-stated thesis:</strong> not established. <strong>ATLAS inferred thesis:</strong> not assessed. Subsequent company financials, dilution, valuation and fundamentals must be investigated independently.</p>
    </details>
   </article>)}
   {!filtered.length&&<p className="chart-note">No matching disclosed holdings within the manager sample you loaded. This does not establish that no institutions hold the company.</p>}
   {filtered.length>35&&<div className="atlas-institution-pagination"><button className="button secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)} type="button">Previous</button><strong>{page} / {Math.ceil(filtered.length/35)}</strong><button className="button secondary" disabled={page>=Math.ceil(filtered.length/35)} onClick={()=>setPage(p=>p+1)} type="button">Next</button></div>}
   <p className="chart-note"><strong>Next evidence gates:</strong> point-in-time issuer/ticker mapping, independent active strategy verification, fund domicile/family relationships, source-specific daily/monthly holdings adapters, valuation and liquidity filters, and unbiased historical validation. No claimed return prediction or Strong Buy ratings.</p>
  </div>}
 </section>;
}
