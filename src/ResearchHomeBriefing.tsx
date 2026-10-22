import {ArrowRight, CircleAlert, Clock3, ShieldCheck} from 'lucide-react';
import {useState} from 'react';
import type {DiscoveryBriefingSnapshot} from './discovery-briefing-model';
import {PP_AND_E_FCF_DISCLOSURE} from './financial-methodology-eligibility';
import {readDiscoveryBriefing} from './discovery-briefing-storage';

type DiscoveryLead=DiscoveryBriefingSnapshot['leads'][number];
type Props={
 storage?:Storage|null;
 currentBriefing?:DiscoveryBriefingSnapshot|null;
 onResearch?:(ticker:string)=>void;
 onConviction?:(ticker:string)=>void;
 onDiscovery?:()=>void;
 onWatchlist?:()=>void;
};

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
const triage=(status:DiscoveryLead['preliminaryScreenStatus'])=>{
 if(status==='preliminary_pass')return 'Investigate further';
 if(status==='failed_thresholds')return 'Does not pass this screen';
 return 'Monitor · resolve evidence';
};
const reason=(lead:DiscoveryLead)=>lead.screeningReasons[0]||'The saved snapshot did not retain a lead-specific screening reason.';
const limitation=(lead:DiscoveryLead)=>lead.evidenceLimitations?.[0]||'No lead-specific limitation was saved; broader investment diligence remains outstanding.';

function browserStorage(storage:Storage|null|undefined):Storage|null {
 if(storage!==undefined)return storage;
 try{return typeof localStorage==='undefined'?null:localStorage}catch{return null}
}

function Metric({name,value,tone='atlas-tone-neutral'}:{name:string;value:string;tone?:string}){
 return <div className="atlas-home-evidence-item"><span>{name}</span><strong className={tone}>{value}</strong></div>;
}

export default function ResearchHomeBriefing({storage,currentBriefing,onResearch,onConviction,onDiscovery,onWatchlist}:Props){
 const [storedBriefing]=useState(()=>{
  const available=browserStorage(storage);
  return available?readDiscoveryBriefing(available):null;
 });
 const briefing=currentBriefing??storedBriefing;

 if(!briefing)return <section className="atlas-home-empty" aria-label="No saved Autonomous Discovery briefing">
  <span className="atlas-home-kicker">Autonomous Discovery · no saved scan</span>
  <h2>No evidence-backed lead<br/><em>is ready to feature yet.</em></h2>
  <p>Run Autonomous Discovery to examine real SEC issuers and save a preliminary financial-screening briefing. ATLAS will not manufacture a company, catalyst, or conviction signal to fill this space.</p>
  {onDiscovery&&<button className="atlas-home-text-action" type="button" onClick={onDiscovery}>Run Autonomous Discovery <ArrowRight size={17}/></button>}
 </section>;

 const [primary,...alternatives]=briefing.leads;
 if(!primary)return <section className="atlas-home-empty" aria-label="Saved scan with no preliminary leads">
  <span className="atlas-home-kicker">Autonomous Discovery · {completedAt(briefing.scanCompletedAt)}</span>
  <h2>The scan completed.<br/><em>No lead met its saved criteria.</em></h2>
  <p>{briefing.issuersExamined.toLocaleString('en-US')} real issuer{briefing.issuersExamined===1?' was':'s were'} examined. The result remains empty rather than promoting an unsupported candidate.</p>
  {onDiscovery&&<button className="atlas-home-text-action" type="button" onClick={onDiscovery}>Review another issuer batch <ArrowRight size={17}/></button>}
 </section>;

 const metricsAvailable=[primary.revenueGrowth,primary.fcfMargin,primary.annualPe].filter(value=>value!==null).length;
 const limitationsRecorded=primary.evidenceLimitations?.length??0;
 return <section className="atlas-home-intelligence" aria-label="Saved Autonomous Discovery briefing">
  <header className="atlas-home-hero">
   <div className="atlas-home-intro">
    <span className="atlas-home-kicker">Latest saved discovery · {completedAt(briefing.scanCompletedAt)}</span>
    <h2>{primary.ticker} surfaced first.<br/><em>The screen is preliminary.</em></h2>
    <p className="atlas-home-hero-reason"><strong>Reason for attention.</strong> {reason(primary)}</p>
    <p className="atlas-home-hero-context">ATLAS retained {briefing.leads.length.toLocaleString('en-US')} preliminary lead{briefing.leads.length===1?'':'s'} after examining {briefing.issuersExamined.toLocaleString('en-US')} issuer{briefing.issuersExamined===1?'':'s'}. This is a financial-screening result, not verified investment conviction.</p>
   </div>

   <aside className="atlas-home-feature" aria-label={`Featured preliminary research lead ${primary.ticker}`}>
    <div className="atlas-home-feature-label"><span><span/> Featured research lead</span><span>Screening · not conviction</span></div>
    <span className="atlas-home-ticker">{primary.ticker}</span>
    <h3>{primary.companyName}</h3>
    <div className="atlas-home-feature-classification"><span>Preliminary classification</span><strong>{label(primary.preliminaryScreenStatus)}</strong><small>{triage(primary.preliminaryScreenStatus)} · not an investment recommendation</small></div>
    <div className="atlas-home-feature-metrics" aria-label={`Featured saved metrics for ${primary.ticker}`}>
     <Metric name="Revenue growth" value={percent(primary.revenueGrowth)} tone={metricTone(primary.revenueGrowth)}/>
     <Metric name="FCF margin" value={percent(primary.fcfMargin)} tone={metricTone(primary.fcfMargin)}/>
     <Metric name="Indicative FY P/E" value={multiple(primary.annualPe)}/>
    </div>
    <div className="atlas-home-feature-risk"><span>Central uncertainty</span><p>{limitation(primary)}</p></div>
    {onResearch&&<button className="atlas-home-text-action" type="button" onClick={()=>onResearch(primary.ticker)}>Investigate {primary.ticker} <ArrowRight size={17}/></button>}
   </aside>
  </header>

  <div className="atlas-home-counts" aria-label="Saved discovery scan summary">
   <div><strong>{briefing.issuersExamined.toLocaleString('en-US')}</strong><span>issuers examined in the saved scan</span></div>
   <div><strong>{briefing.leads.length.toLocaleString('en-US')}</strong><span>preliminary leads retained</span></div>
   <div><strong>{metricsAvailable}/3</strong><span>primary financial metrics available</span></div>
   <div className="atlas-home-count-emphasis"><strong>{limitationsRecorded}</strong><span>lead-specific limitations recorded</span></div>
  </div>

  <article className="atlas-home-story" aria-labelledby="atlas-home-primary-company">
   <div className="atlas-home-story-main">
    <div className="atlas-home-priority-line"><span><span/> Primary saved lead</span><span>Screening · not conviction</span></div>
    <div className="atlas-home-company-heading">
     <div><span className="atlas-home-ticker">{primary.ticker} · evidence review</span><h3 id="atlas-home-primary-company">Why {primary.companyName} needs deeper work</h3><p>Detailed evidence retained by the latest saved scan</p></div>
     <div className="atlas-home-posture"><span>Preliminary triage</span><strong>{triage(primary.preliminaryScreenStatus)}</strong><small>Not an investment recommendation</small></div>
    </div>
    <p className="atlas-home-thesis"><strong>Saved screening rationale.</strong> {primary.screeningReasons.length?primary.screeningReasons.join('; '):'The saved snapshot did not retain a lead-specific screening reason.'}</p>
    <div className="atlas-home-evidence" aria-label={`Saved financial evidence for ${primary.ticker}`}>
     <Metric name="Annual revenue growth" value={percent(primary.revenueGrowth)} tone={metricTone(primary.revenueGrowth)}/>
     <Metric name="FCF margin" value={percent(primary.fcfMargin)} tone={metricTone(primary.fcfMargin)}/>
     <Metric name="Indicative FY P/E" value={multiple(primary.annualPe)}/>
     <Metric name="Emerging Strength" value={label(primary.emergingStrength)} tone={strengthTone(primary.emergingStrength)}/>
    </div>
    <div className="atlas-home-actions" aria-label={`Research actions for ${primary.ticker}`}>
     {onResearch&&<button type="button" onClick={()=>onResearch(primary.ticker)}>Investigate company <ArrowRight size={15}/></button>}
     {onConviction&&<button type="button" onClick={()=>onConviction(primary.ticker)}>Test the case in Conviction Lab</button>}
     {onWatchlist&&<button type="button" onClick={onWatchlist}>Review monitoring workspace</button>}
    </div>
   </div>

   <aside className="atlas-home-story-rail" aria-label="Screening classification and evidence boundaries">
    <section><Clock3 size={17}/><span>Saved classification</span><h4>{label(primary.preliminaryScreenStatus)}</h4><p>This classification is copied from the completed saved scan and remains preliminary.</p></section>
    <section><ShieldCheck size={17}/><span>Emerging Strength</span><h4 className={strengthTone(primary.emergingStrength)}>{label(primary.emergingStrength)}</h4><p>This status describes the saved FCF trend assessment. It is not a verified business-quality or return forecast.</p></section>
    <section className="atlas-home-risk"><CircleAlert size={17}/><span>Central uncertainty</span><h4>{limitation(primary)}</h4><p>The version 1 briefing does not retain source URLs, catalyst evidence, historical pre-news proof, or a comparative ranking score. Reopen Company Research to verify current primary sources.</p></section>
   </aside>
  </article>

  {alternatives.length>0&&<section className="atlas-home-alternatives" aria-labelledby="atlas-home-alternatives-title">
   <div className="atlas-home-section-heading"><div><span className="atlas-home-kicker">Alternative saved leads</span><h3 id="atlas-home-alternatives-title">What remains behind the primary lead</h3></div><p>These companies remain preliminary. Their position reflects saved scan order; the snapshot does not preserve a comparative score or rejection rationale.</p></div>
   <div className="atlas-home-peer-table" role="table" aria-label="Alternative saved Discovery leads">
    <div className="atlas-home-peer-header" role="row"><span role="columnheader">Company</span><span role="columnheader">Screen</span><span role="columnheader">Evidence boundary</span></div>
    {alternatives.slice(0,2).map(lead=><div className="atlas-home-peer-row" role="row" key={lead.ticker}>
     <div role="cell"><strong>{lead.ticker}</strong><span>{lead.companyName}</span></div>
     <div role="cell"><strong>{label(lead.preliminaryScreenStatus)}</strong><span>{label(lead.emergingStrength)}</span></div>
     <p role="cell">{limitation(lead)}</p>
    </div>)}
   </div>
  </section>}

  <p className="atlas-home-boundary"><strong>Research boundary.</strong> This saved assessment reflects the scan-time model; current methodology eligibility has not been rechecked here. A preliminary pass is not verified investment conviction or an investment recommendation. Ordinary FCF screening is not proof of investment quality for insurers and other specialized financial businesses. {PP_AND_E_FCF_DISCLOSURE}</p>
 </section>;
}
