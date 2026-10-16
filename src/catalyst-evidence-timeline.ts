// Attribution discipline for news discovery candidates around a dated SEC 8-K.
// These Google RSS dates are NOT original publication verification and a news
// headline is NOT independent confirmation of the SEC event's substance.
import type {CandidateHeadline} from './catalyst-fundamental-bridge';
import type {FilingEvidenceResult} from './FilingEvidence';

export type EventSubject='earnings_disclosure'|'agreement_disclosure'|'leadership_disclosure'|'regulation_fd_disclosure'|'other_sec_disclosure'|'undetermined';
export type TimelineWarning='news_predates_filing'|'source_timing_unknown'|'source_coverage_incomplete'|'potential_adverse_filing_language';
export type CatalystEvidenceTimeline={
 subject:EventSubject;
 subjectLabel:string;
 recognizedMetrics:{label:string;reportedValue:string;sourceUrl:string|null}[];
 before:number;sameDate:number;after:number;undated:number;future:number;
 earliestHeadlineDate:string|null;latestHeadlineDate:string|null;
 warnings:TimelineWarning[];
 notes:string[];
};
const validDate=(s:string)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function headlineDate(h:CandidateHeadline):string|null{
 const iso=h.feedPublishedAt?.slice(0,10);
 if(iso&&validDate(iso))return iso;
 return h.feedDateOnly&&validDate(h.feedDateOnly)?h.feedDateOnly:null;
}
export function assessCatalystEvidenceTimeline(args:{filingDate:string|null;asOf:string;review:FilingEvidenceResult|null;headlines:CandidateHeadline[]}):CatalystEvidenceTimeline{
 const {filingDate,asOf,review,headlines}=args;
 const topics=review?.evidence?.topics??[];
 const codes=new Set(topics.map(x=>x.code));
 let subject:EventSubject='undetermined';
 let subjectLabel='SEC filing subject not yet established';
 if(codes.has('2.02')){subject='earnings_disclosure';subjectLabel='Results of operations / earnings (8-K Item 2.02)'}
 else if(codes.has('1.01')){subject='agreement_disclosure';subjectLabel='Entry into a material agreement (8-K Item 1.01)'}
 else if(codes.has('5.02')){subject='leadership_disclosure';subjectLabel='Leadership or governance change (8-K Item 5.02)'}
 else if(codes.has('7.01')){subject='regulation_fd_disclosure';subjectLabel='Regulation FD disclosure (8-K Item 7.01)'}
 else if(topics.length){subject='other_sec_disclosure';subjectLabel='Other identified SEC filing subjects'}
 const recognizedMetrics=(review?.evidence?.metrics??[]).slice(0,8).map(m=>({label:m.label,reportedValue:m.reportedValue,sourceUrl:m.sourceUrl??null}));
 const timeline: CatalystEvidenceTimeline={subject,subjectLabel,recognizedMetrics,before:0,sameDate:0,after:0,undated:0,future:0,
  earliestHeadlineDate:null,latestHeadlineDate:null,warnings:[],notes:[]};
 const sortedDates:string[]=[];
 for(const h of headlines){
  const date=headlineDate(h);
  if(!date){timeline.undated++;continue}
  if(!validDate(asOf)||date>asOf){timeline.future++;continue}
  sortedDates.push(date);
  if(!filingDate||!validDate(filingDate)){timeline.undated++;continue}
  if(date<filingDate)timeline.before++;
  else if(date===filingDate)timeline.sameDate++;
  else timeline.after++;
 }
 sortedDates.sort();
 timeline.earliestHeadlineDate=sortedDates[0]??null;
 timeline.latestHeadlineDate=sortedDates.at(-1)??null;
 if(timeline.before){timeline.warnings.push('news_predates_filing');timeline.notes.push(timeline.before+' issuer-name-matched RSS headline(s) predate the 8-K filing date; the company event may already have been public or priced before SEC acceptance. RSS dates do not prove original article first-publication time.')}
 if(!filingDate||!validDate(filingDate)||timeline.undated||timeline.future){timeline.warnings.push('source_timing_unknown');timeline.notes.push('At least one news/filing timestamp cannot be aligned. Future-dated RSS candidates must not influence an as-of investment assessment.')}
 if(!review||review.sourceStatus==='unavailable'||review.sourceStatus==='partial_text'){timeline.warnings.push('source_coverage_incomplete');timeline.notes.push('SEC document reading is incomplete relative to the entire submission; missing material exhibits or opposing facts cannot be ruled out.')}
 if((review?.evidence?.cautions??[]).length){timeline.warnings.push('potential_adverse_filing_language');timeline.notes.push('Potential caution language detected in SEC text; verify surrounding context before considering a bullish catalyst.')}
 timeline.notes.push('Filing item codes and reported financial phrases describe evidence, not an earnings surprise against consensus, management guidance accuracy, event causation or an investment rating.');
 timeline.notes.push('Related headlines are issuer-matched discovery candidates. Article bodies, publisher independence and original public-release timestamps have NOT been verified.');
 return timeline;
}
