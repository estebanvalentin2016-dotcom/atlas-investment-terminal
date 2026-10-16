// Research triage between real 8-K text, *candidate* RSS headlines,
// source-dated SEC financials and indicative IEX annual P/E.
// A topic overlap is NOT verified independent article corroboration.
// No candidate is cleared for a buy/return forecast here.
import {initialAutonomousScreen,type ScreenResult} from './autonomous-screen';
import {annualPeFromSec,scoreCompany,defaultRankWeights,type SecCompany,type MarketValuationClose} from './ranking-model';
import {headlineReferencesIssuer} from './issuer-news-identity';
import type {FilingEvidenceResult} from './FilingEvidence';

export type CandidateHeadline={title:string;source:string;link:string|null;feedPublishedAt:string|null;feedDateOnly:string|null};
export type BridgeTopic='guidance'|'contract'|'regulatory approval'|'revenue';
export type BridgeResult={
 status:'provisional_alignment'|'incomplete'|'caution'|'not_aligned';
 priority:number|null;financialScore:number|null;screen:ScreenResult|null;
 fyPe:number|null;topic:BridgeTopic|null;matchedHeadline:CandidateHeadline|null;
 verified:{issuerFiling:boolean;secAnnualFinancials:boolean;completedClose:boolean};
 gaps:string[];interpretation:string;
};
const validDate=(s:string)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const filingTopics:(readonly [BridgeTopic,RegExp,RegExp])[]=[
 ['guidance',/Raised outlook \/ guidance/i,/\b(?:rais(?:e|es|ed)|lift(?:s|ed)?|boost(?:s|ed)?|hik(?:e|es|ed)|increas(?:es|ed))\b[^.!?]{0,75}\b(?:guidance|outlook|forecast)\b/i],
 ['contract',/Contract award language/i,/\b(?:wins?|won|secures?|secured|awarded|lands?|landed)\b[^.!?]{0,80}\b(?:contract|agreement|award)\b/i],
 ['regulatory approval',/Regulatory approval language/i,/\b(?:fda|regulator|regulatory)\b[^.!?]{0,90}\b(?:approv(?:al|es|ed)|clear(?:ance|ed)|authorize(?:d|s)?)\b/i],
 ['revenue',/Record revenue language/i,/\b(?:record\s+(?:quarterly\s+|annual\s+)?revenue|revenue\s+(?:grew|grows|surges?|rose|rises|up)|sales\s+(?:grew|grows|surges?|rose|rises|up))\b/i]
];
const elapsed=(newer:string,older:string)=>(Date.parse(newer+'T00:00:00Z')-Date.parse(older+'T00:00:00Z'))/86400000;
export function assessCatalystFundamentalBridge(args:{
 ticker:string;name:string;filed:string|null;filingUrl:string;review:FilingEvidenceResult|null;
 headlines:CandidateHeadline[];company:SecCompany|null;quote:MarketValuationClose|null;asOf:string;autonomousPass?:boolean;
}):BridgeResult{
 const {ticker,name,filed,filingUrl,review,headlines,company,quote,asOf}=args;
 const gaps:string[]=[];
 const selectedDocumentCoverage=!!review&&review.url===filingUrl&&review.reviewMethod==='selected_documents'&&
  review.selection?.primaryLocated===true&&review.selection.exhibitsListed===review.selection.selectedExhibits&&
  Array.isArray(review.documents)&&review.documents.length>0&&review.documents.some(d=>d.role==='Primary 8-K'&&d.status==='reviewed')&&
  review.documents.every(d=>d.status==='reviewed')&&(!review.sourceProblems||review.sourceProblems.length===0);
 // A correctly retrieved primary 8-K plus ALL *listed Exhibit 99* files
 // supports provisional source-text triage. It does NOT mean the full SEC
 // submission, other exhibits, or the article were comprehensively reviewed.
 const issuerFiling=!!review&&review.url===filingUrl&&!!review.evidence&&
  (review.sourceStatus==='reviewed_text'||selectedDocumentCoverage);
 if(!issuerFiling)gaps.push('Selected SEC 8-K source coverage cannot be established; missing text and exhibits may contain opposing facts.');
 if(selectedDocumentCoverage)gaps.push('Primary 8-K and listed Exhibit 99 documents were read, but other exhibits and context are not comprehensively reviewed; full-filing verification is still missing.');
 if(!validDate(asOf)||!filed||!validDate(filed)||filed>asOf||elapsed(asOf,filed)>95)gaps.push('8-K filing date unavailable or outside the supported lookback.');
 const positive=review?.url===filingUrl&&review?.sourceStatus!=='unavailable'?review?.evidence?.potential??[]:[];
 const cautions=review?.url===filingUrl?review?.evidence?.cautions??[]:[];
 if(cautions.length)gaps.push('Potential adverse language appears in the filing; investigate context before bullish interpretation.');
 // We only let SEC-extracted positive development phrases qualify as the
 // potential catalyst. Issuer-name-only RSS stories earn no alignment.
 let topic:BridgeTopic|null=null,matchedHeadline:CandidateHeadline|null=null;
 for(const [kind,secRe,newsRe] of filingTopics){
  if(!positive.some(p=>secRe.test(p.label)))continue;
  const hit=headlines.find(h=>{
   if(!h.link?.startsWith('https://news.google.com/')||!headlineReferencesIssuer(h.title,name)||!newsRe.test(h.title))return false;
   const rssDate=h.feedPublishedAt&&validDate(h.feedPublishedAt.slice(0,10))?h.feedPublishedAt.slice(0,10):h.feedDateOnly;
   // An RSS headline before the SEC filing is valuable historical context,
   // but not evidence of a fresh post-filing catalyst. Future news must not
   // leak into an earlier source-dated research snapshot.
   return !!rssDate&&validDate(rssDate)&&!!filed&&validDate(filed)&&validDate(asOf)&&
    rssDate>=filed&&rssDate<=asOf&&elapsed(rssDate,filed)<=4;
  });
  if(hit){topic=kind;matchedHeadline=hit;break}
 }
 if(!topic)gaps.push('No SEC positive-language topic also appears in an issuer-identified, same-or-later-date RSS headline. Pre-filing stories and ticker matches cannot certify a new SEC catalyst.');
 if(topic)gaps.push('SEC text and RSS headline have an unverified topic overlap; primary article substance, independent publisher and first-public time were NOT checked.');
 const secCurrent=!!company&&company.ticker===ticker&&company.source?.startsWith('https://data.sec.gov/')&&
  Array.isArray(company.metrics)&&validDate(asOf);
 const screen=secCurrent?initialAutonomousScreen(company!,asOf):null;
 if(!screen||screen.status!=='preliminary_pass')gaps.push('The SEC annual financial growth/FCF/net-margin preliminary screen has not passed: '+(screen?.reasons.join('; ')??'issuer source unavailable')+'.');
 const completedClose=!!quote&&quote.ticker===ticker&&quote.feed==='IEX'&&quote.completedSession&&Number.isFinite(quote.price)&&quote.price>0&&validDate(quote.sessionDate)&&validDate(asOf)&&quote.sessionDate<=asOf&&elapsed(asOf,quote.sessionDate)<=10;
 if(!completedClose)gaps.push('No fresh completed IEX close for the same ticker.');
 const pe=secCurrent&&completedClose?annualPeFromSec(company!,quote).pe:null;
 if(pe===null)gaps.push('Indicative current-price/SEC-FY EPS P/E unavailable. Missing does not mean cheap.');
 else if(pe>=40)gaps.push('FY P/E '+pe.toFixed(1)+'x exceeds provisional <40x valuation triage; not a fair-value assessment.');
 else gaps.push('FY P/E '+pe.toFixed(1)+'x is indicative only; forward earnings, share classes, debt and intrinsic value remain unverified.');
 const rank=secCurrent&&completedClose?scoreCompany(company!,defaultRankWeights,pe):null;
 const financialScore=rank?.score??null;
 if(financialScore===null)gaps.push('The weighted source-dated fundamental score is not established.');
 const ready=!!topic&&issuerFiling&&cautions.length===0&&screen?.status==='preliminary_pass'&&completedClose&&pe!==null&&pe<40&&financialScore!==null&&
  !!filed&&validDate(filed)&&filed<=asOf&&elapsed(asOf,filed)<=95;
 const status:BridgeResult['status']=cautions.length?'caution':ready?'provisional_alignment':!company||!review?'incomplete':'not_aligned';
 return {status,priority:ready?financialScore:null,financialScore,screen,fyPe:pe,topic,matchedHeadline,
  verified:{issuerFiling,secAnnualFinancials:screen?.status==='preliminary_pass',completedClose},
  gaps,
  interpretation:ready?'Provisional research alignment: positive SEC wording, same-topic issuer news headline, annual financial threshold pass and indicative FY multiple below 40x. This is NOT verified article corroboration, intrinsic undervaluation, a buy rating or a calibrated return forecast.':'No source-gated bullish investment conclusion. A new filing, favorable earnings, interesting headline or good financials alone do not establish an attractive investment.'
 };
}
