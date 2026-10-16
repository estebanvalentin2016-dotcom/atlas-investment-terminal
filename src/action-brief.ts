// Research-home decision briefing. Grounded in source observations, never a
// trading signal, a portfolio recommendation, or calibrated expected returns.
import type {BridgeResult} from './catalyst-fundamental-bridge';
import type {EconomicSignificance} from './economic-significance';
import type {CatalystEvidenceTimeline} from './catalyst-evidence-timeline';

export type ResearchAction='investigate'|'watch'|'deprioritize'|'checking';
export type ActionBrief={
 action:ResearchAction;headline:string;finding:string;interpretation:string;nextStep:string;
 evidenceNote:string;verifiedBuy:false;
};
export function createActionBrief(input:{
 bridge:BridgeResult;economics:EconomicSignificance;timeline:CatalystEvidenceTimeline;
 loaded:boolean;filed:string|null;
}):ActionBrief{
 const {bridge,economics,timeline,loaded,filed}=input;
 const kind=timeline.subject;
 const event=kind==='earnings_disclosure'?'An earnings/results 8-K was filed':
  kind==='agreement_disclosure'?'A material-agreement 8-K was filed':
  kind==='leadership_disclosure'?'A leadership/governance 8-K was filed':
  kind==='regulation_fd_disclosure'?'A Regulation FD 8-K was filed':
  kind==='other_sec_disclosure'?'An 8-K with identified SEC items was filed':
  'An SEC 8-K was observed';
 const topNumber=economics.signals.find(x=>x.changePct!==null);
 const finding=topNumber?
   event+'; SEC text reports '+topNumber.reportedValue+'.':
   event+'; no reliable incremental earnings or cash-flow impact has been quantified.';
 const evidenceNote=(filed?'8-K '+filed:'8-K date not established')+' · '+(
  bridge.fyPe===null?'FY P/E unavailable':'Indicative FY P/E '+bridge.fyPe.toFixed(1)+'×')+
  ' · '+(economics.annual?.filed?'SEC FY context filed '+economics.annual.filed:'annual context incomplete');
 const finish=(action:ResearchAction,headline:string,interpretation:string,nextStep:string):ActionBrief=>
  ({action,headline,finding,interpretation,nextStep,evidenceNote,verifiedBuy:false});
 if(!loaded)return finish('checking','Checking sources','ATLAS has not completed the source review for this issuer.','Complete filing, financial and news checks before prioritizing.');
 if(economics.status==='adverse_or_mixed'||bridge.status==='caution'){
  return finish('deprioritize','Set aside as a bullish candidate',
   'Potentially adverse or mixed SEC evidence prevents a clean positive catalyst case.',
   'Reconcile the negative figures and filing context; reconsider only if the downside is explained.');
 }
 if(bridge.status==='provisional_alignment'&&economics.status==='quantified_improvement'){
  return finish('investigate','Investigate this potential opportunity',
   'Positive SEC-reported business movement, a related news topic, financial-screen eligibility and an indicative valuation check align. Upside is not yet established.',
   'Verify the operating period, expectations before release, and forward per-share valuation before considering a purchase.');
 }
 if(bridge.status==='provisional_alignment'){
  return finish('investigate','Verify catalyst economics',
   'Filing/news topics and preliminary financial/valuation conditions align, but incremental profits are unproven.',
   'Reconcile the actual change in operating earnings and what the stock price already assumes.');
 }
 if(economics.status==='quantified_improvement'){
  return finish('watch','Investigate reported improvement',
   'The SEC text reports positive movement, but corroboration, annual quality or valuation gates are incomplete.',
   'Compare the disclosed period with prior guidance and expectations; then retest valuation and downside.');
 }
 if(bridge.fyPe!==null&&bridge.fyPe>=40){
  return finish('deprioritize','Valuation hurdle is high',
   'The current indicative FY earnings multiple exceeds the provisional valuation screen; this alone is not a fair-value verdict.',
   'Look for credible forward earnings and a price-sensitive valuation before elevating the company.');
 }
 if(bridge.screen?.status==='failed_thresholds'){
  return finish('watch','Watch for stronger fundamentals',
   'Current SEC annual results do not clear the provisional quality screen; a recent filing is not enough.',
   'Retest annual growth, funding and profitability after substantive new disclosures.');
 }
 if(timeline.before>0){
  return finish('watch','Check what the market knew earlier',
   'Related news candidates precede the 8-K, so treating the filing date as the start of the event may be misleading.',
   'Establish the first public release and compare the stock price from that point before testing upside.');
 }
 if(kind==='earnings_disclosure'){
  return finish('watch','Confirm earnings significance',
   'An earnings filing is present, but ATLAS has not established whether results exceeded expectations or improved future profits.',
   'Reconcile reported results with prior company guidance, pre-release consensus and current valuation.');
 }
 if(bridge.status==='incomplete'||economics.status==='source_unavailable'){
  return finish('watch','Await reliable source evidence',
   'Filing, financial or quote coverage is incomplete, so a directional conclusion would be speculative.',
   'Complete source reconciliation before ranking this company as an opportunity.');
 }
 return finish('deprioritize','No compelling catalyst established',
  'Available SEC text and issuer-name-matched headlines do not yet establish a material, investable change.',
  'Revisit only when substantive business news, verified financial improvement or a price-sensitive thesis emerges.');
}
