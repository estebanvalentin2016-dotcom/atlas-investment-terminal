import {describe,expect,it} from 'vitest';
import {createActionBrief} from './action-brief';
import type {BridgeResult} from './catalyst-fundamental-bridge';
import type {EconomicSignificance} from './economic-significance';
import type {CatalystEvidenceTimeline} from './catalyst-evidence-timeline';
const bridge=(status:BridgeResult['status']='not_aligned',pe:number|null=20):BridgeResult=>({
 status,economicStatus:'unquantified',priority:null,financialScore:40,fyPe:pe,topic:null,matchedHeadline:null,
 screen:{ticker:'TEST',status:'incomplete_financials',filed:'2026-02-15',growth:null,fcfMargin:null,netMargin:null,score:null,reasons:[]},
 verified:{issuerFiling:false,secAnnualFinancials:false,completedClose:false},gaps:[],interpretation:'Not a buy'
});
const economics=(status:EconomicSignificance['status']='unquantified'):EconomicSignificance=>({
 status,annual:null,incompleteSource:true,signals:[],sensitivity:null,verifiedEarningsSurprise:false,
 independentNewsCorroboration:false,verifiedMateriality:false,fairValueImpact:false,limitations:[],explanation:''
});
const timeline=(subject:CatalystEvidenceTimeline['subject']='undetermined',before=0):CatalystEvidenceTimeline=>({
 subject,subjectLabel:'source filing',recognizedMetrics:[],before,sameDate:0,after:0,undated:0,future:0,
 earliestHeadlineDate:null,latestHeadlineDate:null,sameSubjectHeadlines:0,preFilingSameSubjectHeadlines:0,warnings:[],notes:[]
});
const assess=(b=bridge(),e=economics(),t=timeline(),loaded=true)=>
 createActionBrief({bridge:b,economics:e,timeline:t,loaded,filed:'2026-10-15'});
describe('Concise, conservative action brief from the same facts as the deep SEC research',()=>{
 it('gives a plain next research action instead of an invented buy verdict',()=>{
  const x=assess(bridge('not_aligned',9.3),economics(),timeline('earnings_disclosure'));
  expect(x.action).toBe('watch');
  expect(x.headline).toBe('Confirm earnings significance');
  expect(x.finding).toContain('earnings/results 8-K');
  expect(x.interpretation).toContain('not established whether results exceeded expectations');
  expect(x.nextStep).toContain('pre-release consensus');
  expect(x.verifiedBuy).toBe(false);
 });
 it('uses missing-fundamentals status and an older news date to prioritize a timestamp check',()=>{
  const x=assess(bridge(),economics(),timeline('leadership_disclosure',3));
  expect(x.action).toBe('watch');
  expect(x.headline).toContain('market knew earlier');
 });
 it('never promotes a high FY earnings multiple merely because SEC news is recent',()=>{
  const x=assess(bridge('not_aligned',120.1),economics(),timeline('earnings_disclosure'));
  expect(x.action).toBe('deprioritize');
  expect(x.headline).toBe('Valuation hurdle is high');
  expect(x.evidenceNote).toContain('120.1×');
  expect(x.interpretation).toContain('not a fair-value verdict');
 });
 it('explicitly sets aside adverse disclosure evidence',()=>{
  const b=bridge('caution',9);
  const x=assess(b,economics('adverse_or_mixed'),timeline('earnings_disclosure'));
  expect(x.action).toBe('deprioritize');
  expect(x.headline).toContain('bullish');
  expect(x.nextStep).toContain('negative figures');
 });
 it('distinguishes an aligned research question from a verified investment idea',()=>{
  const b=bridge('provisional_alignment',25);b.topic='guidance';
  const e=economics('quantified_improvement');
  e.signals=[{category:'revenue_change',label:'Reported revenue growth',reportedValue:'19% increase in revenue',changePct:19,
   direction:'improvement',sourceUrl:'https://www.sec.gov/Archives/edgar/data/123/filing.txt',excerpt:'19% increase in revenue'}];
  const x=assess(b,e,timeline('earnings_disclosure'));
  expect(x.action).toBe('investigate');
  expect(x.finding).toContain('19% increase in revenue');
  expect(x.nextStep).toContain('forward per-share valuation');
  expect(x.verifiedBuy).toBe(false);
 });
 it('does not tell user to invest when source loading is incomplete or there is no meaningful catalyst',()=>{
  expect(assess(bridge(),economics(),timeline(),false).action).toBe('checking');
  const x=assess();
  expect(x.action).toBe('deprioritize');
  expect(x.headline).toBe('No compelling catalyst established');
  expect(x.verifiedBuy).toBe(false);
 });
});
