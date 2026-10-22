import {useState,useSyncExternalStore} from 'react';
import MonthlyPicksDashboard from './MonthlyPicksDashboard';
import ResearchHomeBriefing from './ResearchHomeBriefing';
import {autonomousDiscoveryController,DISCOVERY_BATCH_SIZE,type DiscoveryController} from './autonomous-discovery-controller';
import './research-home.css';
type Destination='Autonomous Discovery'|'Screener'|'Opportunity Radar'|'Company Research'|'Conviction Lab'|'Watchlist'|'Discovery Feed';
export const filingQueueActivation=(wasActivated:boolean,isOpen:boolean)=>wasActivated||isOpen;
export default function ResearchHome({navigate,onResearch,onConviction,briefingStorage,controller=autonomousDiscoveryController}:{navigate:(page:Destination)=>void;onResearch?:(ticker:string)=>void;onConviction?:(ticker:string)=>void;briefingStorage?:Storage|null;controller?:DiscoveryController}){
 const [filingQueueActivated,setFilingQueueActivated]=useState(false);
 const scan=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
 const scanStatus=scan.busy?(scan.reviewingLeads?'Reviewing preliminary leads.':`Checking SEC issuers · ${scan.checkedIssuers} of up to ${scan.activeBatchCount*DISCOVERY_BATCH_SIZE} checked.`):scan.error?'Discovery could not finish. No new briefing was saved.':scan.done?`Scan complete · ${scan.briefing?.issuersExamined??0} issuer records assessed${scan.failed.length?`, ${scan.failed.length} source unavailable`:''}.`:scan.briefing?`Recent scan available · ${scan.briefing.issuersExamined} issuer records assessed.`:'Preparing an SEC discovery scan.';
 return <section className="atlas-research-home">
  <ResearchHomeBriefing storage={briefingStorage} currentBriefing={scan.briefing} scanBusy={scan.busy} onResearch={onResearch} onConviction={onConviction} onDiscovery={()=>navigate('Autonomous Discovery')} onWatchlist={()=>navigate('Watchlist')}/>
  <p className="atlas-home-scan-status" role="status" aria-live="polite"><strong>Discovery:</strong> {scanStatus} {scan.error&&<button type="button" className="atlas-home-text-action" onClick={()=>void controller.retryAutomatic()}>Retry the 72-company scan</button>}</p>
  <details className="atlas-home-secondary-intelligence" onToggle={event=>{const isOpen=event.currentTarget.open;setFilingQueueActivated(activated=>filingQueueActivation(activated,isOpen))}}>
   <summary><div><span className="atlas-home-kicker">Secondary research process</span><h2>Recent catalysts and SEC filing intelligence</h2><p>This queue independently triages recent filings and public-news candidates. It may reach a different provisional conclusion from Autonomous Discovery.</p></div><span>Open filing intelligence</span></summary>
   <p className="atlas-home-process-note"><strong>Separate evidence paths.</strong> Autonomous Discovery screens saved annual financial and valuation evidence; this queue examines recent catalysts and SEC filings. Neither process establishes verified investment conviction.</p>
   {filingQueueActivated&&<MonthlyPicksDashboard heading="Recent catalysts and SEC filing intelligence" showScenarioActions={false} onConviction={onConviction} onOpportunity={()=>navigate('Opportunity Radar')}/>}
  </details>
  <nav className="atlas-home-footer-actions" aria-label="Research Home destinations"><button type="button" onClick={()=>navigate('Autonomous Discovery')}>Run another discovery scan</button><button type="button" onClick={()=>navigate('Watchlist')}>Review saved research</button></nav>
 </section>;
}
