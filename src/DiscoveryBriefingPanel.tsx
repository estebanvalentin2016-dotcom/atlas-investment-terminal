import {useState} from 'react';
import {readDiscoveryBriefing} from './discovery-briefing-storage';

function browserStorage(storage:Storage|null|undefined):Storage|null {
  if(storage!==undefined)return storage;
  try{return typeof localStorage==='undefined'?null:localStorage}catch{return null}
}

export default function DiscoveryBriefingPanel({storage}:{storage?:Storage|null}){
  const [briefing]=useState(()=>{
    const available=browserStorage(storage);
    return available?readDiscoveryBriefing(available):null;
  });
  return briefing?<div className="atlas-discovery-briefing">
   <h4>Autonomous Discovery Briefing</h4>
   <p><strong>Scan completed:</strong> {briefing.scanCompletedAt} · <strong>Companies examined:</strong> {briefing.issuersExamined}</p>
   {briefing.leads.length?<p>{briefing.leads.slice(0,3).map((lead,index)=><span key={lead.ticker}>{lead.ticker} · {lead.companyName}{index<Math.min(briefing.leads.length,3)-1?' · ':''}</span>)}</p>:<p className="chart-note">No preliminary leads were saved from this scan.</p>}
   <p className="chart-note">Preliminary research leads — not investment recommendations.</p>
  </div>:<div className="atlas-discovery-briefing">
   <h4>Autonomous Discovery Briefing</h4>
   <p className="chart-note">Run Autonomous Discovery to generate a research briefing.</p>
  </div>;
}
