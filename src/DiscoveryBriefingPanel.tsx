import {useState} from 'react';
import type {DiscoveryBriefingSnapshot} from './discovery-briefing-model';
import {readDiscoveryBriefing} from './discovery-briefing-storage';

type DiscoveryLead=DiscoveryBriefingSnapshot['leads'][number];

const percent=(value:number|null)=>value===null?'Unknown':`${value>0?'+':''}${value.toFixed(1)}%`;
const multiple=(value:number|null)=>value===null?'Unknown':`${value.toFixed(1)}×`;
const label=(value:string)=>value.split('_').map((word,index)=>index===0?word.charAt(0).toUpperCase()+word.slice(1):word).join(' ');
const metricTone=(value:number|null)=>value===null||value===0?'atlas-tone-neutral':value>0?'atlas-tone-positive':'atlas-tone-negative';
const strengthTone=(status:DiscoveryLead['emergingStrength'])=>status==='improving'?'atlas-tone-positive':status==='not_improving'?'atlas-tone-caution':'atlas-tone-neutral';
const completedAt=(value:string)=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'Unknown':new Intl.DateTimeFormat('en-US',{
    year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'
  }).format(date);
};

function LeadMetrics({lead}:{lead:DiscoveryLead}){
  return <div className="atlas-key-return atlas-discovery-metrics">
    <div><span className="atlas-glance-label">Annual revenue growth</span><strong className={`atlas-glance-value ${metricTone(lead.revenueGrowth)}`}>{percent(lead.revenueGrowth)}</strong></div>
    <div><span className="atlas-glance-label">FCF margin</span><strong className={`atlas-glance-value ${metricTone(lead.fcfMargin)}`}>{percent(lead.fcfMargin)}</strong></div>
    <div><span className="atlas-glance-label">Indicative FY P/E</span><strong className="atlas-glance-value atlas-tone-neutral">{multiple(lead.annualPe)}</strong></div>
    <div><span className="atlas-glance-label">Screening status</span><strong>{label(lead.preliminaryScreenStatus)}</strong></div>
    <div><span className="atlas-glance-label">Emerging Strength</span><strong className={strengthTone(lead.emergingStrength)}>{label(lead.emergingStrength)}</strong></div>
  </div>;
}

function EvidenceLimitations({lead}:{lead:DiscoveryLead}){
  return <p className="chart-note"><strong>Known evidence limitations:</strong> {lead.evidenceLimitations?.length?lead.evidenceLimitations.join('; '):'No lead-specific limitation was saved; broader investment diligence remains outstanding.'}</p>;
}

function browserStorage(storage:Storage|null|undefined):Storage|null {
  if(storage!==undefined)return storage;
  try{return typeof localStorage==='undefined'?null:localStorage}catch{return null}
}

export default function DiscoveryBriefingPanel({storage,variant='full',onSelect}:{storage?:Storage|null;variant?:'full'|'handoff';onSelect?:(ticker:string)=>void}){
  const [briefing]=useState(()=>{
    const available=browserStorage(storage);
    return available?readDiscoveryBriefing(available):null;
  });
  if(variant==='handoff'){
    const primary=briefing?.leads[0];
    return <aside className="atlas-research-handoff" aria-label="Autonomous Discovery research handoff">
      <span>Discovery handoff</span>
      {primary?<>
        <div><strong>{primary.ticker}</strong><p>{primary.companyName}</p></div>
        <p>{label(primary.preliminaryScreenStatus)} · saved {completedAt(briefing.scanCompletedAt)}. Preliminary screening only.</p>
        {onSelect&&<button type="button" onClick={()=>onSelect(primary.ticker)}>Investigate {primary.ticker}</button>}
      </>:briefing?<p>The latest scan examined {briefing.issuersExamined.toLocaleString('en-US')} issuer{briefing.issuersExamined===1?'':'s'} and retained no preliminary lead.</p>:<p>No saved Discovery lead is available. Run Autonomous Discovery when you need a new research starting point.</p>}
    </aside>;
  }
  if(!briefing)return <section className="atlas-discovery-briefing">
    <h4>Autonomous Discovery Briefing</h4>
    <p className="chart-note">No saved scan is available. Run Autonomous Discovery to generate a preliminary research briefing.</p>
  </section>;

  const [primary,...remaining]=briefing.leads;
  return <section className="atlas-discovery-briefing" aria-label="Saved Autonomous Discovery briefing">
    <div className="atlas-discovery-briefing-head">
      <div><span className="eyebrow">SAVED AUTONOMOUS DISCOVERY</span><h4>Preliminary research briefing</h4></div>
      <span className="tag">SCREENING · NOT CONVICTION</span>
    </div>
    <p className="atlas-discovery-scan-meta"><strong>Scan completed:</strong> {completedAt(briefing.scanCompletedAt)} · <strong>Issuers examined:</strong> {briefing.issuersExamined.toLocaleString('en-US')}</p>
    {primary?<>
      <article className="atlas-autonomous-lead atlas-discovery-primary">
        <div className="atlas-autonomous-heading">
          <div><small>Primary saved lead · preliminary financial screening</small><strong>{primary.companyName}</strong><span>{primary.ticker}</span></div>
          <span>NOT A BUY RATING</span>
        </div>
        <LeadMetrics lead={primary}/>
        <p className="chart-note"><strong>Screening basis:</strong> {primary.screeningReasons.length?primary.screeningReasons.join('; '):'No screening reason was saved.'}</p>
        <EvidenceLimitations lead={primary}/>
      </article>
      {remaining.length>0&&<div className="atlas-discovery-alternatives">
        <h5>Additional preliminary leads</h5>
        <div className="atlas-discovery-alternative-grid">
          {remaining.slice(0,2).map(lead=><article className="atlas-discovery-alternative" key={lead.ticker}>
            <div><small>Alternative research lead</small><strong>{lead.companyName}</strong><span>{lead.ticker}</span></div>
            <LeadMetrics lead={lead}/>
            <EvidenceLimitations lead={lead}/>
          </article>)}
        </div>
      </div>}
    </>:<div className="atlas-discovery-empty">
      <strong>No preliminary leads met the saved scan criteria.</strong>
      <p className="chart-note">The scan examined real issuers and did not manufacture a candidate. Run Autonomous Discovery again to examine another SEC-index batch.</p>
    </div>}
    <p className="atlas-discovery-caution"><strong>Research boundary:</strong> These are preliminary financial-screening results, not verified investment conviction or investment recommendations. FCF margin is a mechanical screening input, not proof of investment quality; for insurers and other specialized financial businesses, ordinary FCF screening may not be decision-useful without sector-specific analysis.</p>
  </section>;
}
