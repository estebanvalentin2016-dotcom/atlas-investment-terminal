// Transparent research ordering within *one reviewed SEC filing batch*.
// Never a prospective return model, buy verdict, company-wide ranking or
// claim that low FY P/E means a stock is undervalued.
import type {BridgeResult} from './catalyst-fundamental-bridge';
export type ResearchTriageEntry={
 assessment:BridgeResult;
 historicalPass:boolean;
 filed:string|null;
 ticker:string;
};
const stage=(status:BridgeResult['status'])=>status==='provisional_alignment'?4:status==='not_aligned'?2:status==='incomplete'?1:0;
const marketValuationCheck=(pe:number|null)=>pe===null?0:pe>=80?-2:pe>=40?-1:pe>0?1:0;
export function compareResearchTriage(a:ResearchTriageEntry,b:ResearchTriageEntry):number{
 const aa=a.assessment,bb=b.assessment;
 const pick=stage(bb.status)-stage(aa.status)||
  Number(bb.screen?.status==='preliminary_pass')-Number(aa.screen?.status==='preliminary_pass')||
  Number(!!bb.topic)-Number(!!aa.topic)||
  // Make valuation uncertainty/hurdles visible in ordering rather than letting
  // an expensive reported FY P/E win solely on one extra margin point.
  marketValuationCheck(bb.fyPe)-marketValuationCheck(aa.fyPe)||
  Number(b.historicalPass&&bb.screen?.status==='preliminary_pass')-Number(a.historicalPass&&aa.screen?.status==='preliminary_pass')||
  (bb.priority??bb.financialScore??-1)-(aa.priority??aa.financialScore??-1)||
  (b.filed??'').localeCompare(a.filed??'')||a.ticker.localeCompare(b.ticker);
 return pick;
}
