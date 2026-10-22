import {useState,useSyncExternalStore} from 'react';
import MonthlyPicksDashboard from './MonthlyPicksDashboard';
import ResearchHomeBriefing from './ResearchHomeBriefing';
import {autonomousDiscoveryController,type DiscoveryController} from './autonomous-discovery-controller';
import './research-home.css';
type Destination='Autonomous Discovery'|'Screener'|'Opportunity Radar'|'Company Research'|'Conviction Lab'|'Watchlist'|'Discovery Feed';
export const filingQueueActivation=(wasActivated:boolean,isOpen:boolean)=>wasActivated||isOpen;
export default function ResearchHome({navigate,onResearch,onConviction,briefingStorage,controller=autonomousDiscoveryController}:{navigate:(page:Destination)=>void;onResearch?:(ticker:string)=>void;onConviction?:(ticker:string)=>void;briefingStorage?:Storage|null;controller?:DiscoveryController}){
 const [filingQueueActivated,setFilingQueueActivated]=useState(false);
 const scan=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
 const scanStatus=scan.busy?scan.progress||'Starting…':scan.error?'Unavailable · '+scan.error:scan.done?`Completed · ${scan.briefing?.issuersExamined??0} issuer${scan.briefing?.issuersExamined===1?'':'s'} examined.`:'No scan running. Start a scan in Autonomous Discovery.';
 return <section className="atlas-research-home">
  <ResearchHomeBriefing storage={briefingStorage} currentBriefing={scan.briefing} onResearch={onResearch} onConviction={onConviction} onDiscovery={()=>navigate('Autonomous Discovery')} onWatchlist={()=>navigate('Watchlist')}/>
  <p className="atlas-home-scan-status" role="status" aria-live="polite"><strong>Discovery scan:</strong> {scanStatus}</p>
  <details className="atlas-home-secondary-intelligence" onToggle={event=>{const isOpen=event.currentTarget.open;setFilingQueueActivated(activated=>filingQueueActivation(activated,isOpen))}}>
   <summary><div><span className="atlas-home-kicker">Secondary research process</span><h2>Recent catalysts and SEC filing intelligence</h2><p>This queue independently triages recent filings and public-news candidates. It may reach a different provisional conclusion from Autonomous Discovery.</p></div><span>Open filing intelligence</span></summary>
   <p className="atlas-home-process-note"><strong>Separate evidence paths.</strong> Autonomous Discovery screens saved annual financial and valuation evidence; this queue examines recent catalysts and SEC filings. Neither process establishes verified investment conviction.</p>
   {filingQueueActivated&&<MonthlyPicksDashboard heading="Recent catalysts and SEC filing intelligence" showScenarioActions={false} onConviction={onConviction} onOpportunity={()=>navigate('Opportunity Radar')}/>}
  </details>
  <nav className="atlas-home-footer-actions" aria-label="Research Home destinations"><button type="button" onClick={()=>navigate('Autonomous Discovery')}>Run another discovery scan</button><button type="button" onClick={()=>navigate('Watchlist')}>Review saved research</button></nav>
 </section>;
}
