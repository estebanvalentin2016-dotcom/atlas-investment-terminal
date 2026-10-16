import {useState} from 'react';
import FilingPriceContext from './FilingPriceContext';
import type {FilingEvidenceResult} from './FilingEvidence';
import type {CandidateHeadline} from './catalyst-fundamental-bridge';
import {assessCatalystEvidenceTimeline} from './catalyst-evidence-timeline';

export default function CatalystVerificationPanel({ticker,issuerName,filingDate,sourceUrl,review,headlines,asOf}:{
 ticker:string;issuerName:string;filingDate:string|null;sourceUrl:string;review:FilingEvidenceResult|null;headlines:CandidateHeadline[];asOf:string;
}){
 const [expanded,setExpanded]=useState(false);
 const report=assessCatalystEvidenceTimeline({filingDate,asOf,issuerName,review,headlines});
 return <section className="atlas-catalyst-verification" aria-label={'Catalyst source chronology for '+ticker}>
  <div className="atlas-catalyst-verification-head">
   <div><strong>Is this a real, newly developing catalyst?</strong><p className="chart-note">SEC filing subject · dated related news · stock versus SPY after SEC acceptance</p></div>
   <button type="button" className="button secondary" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide catalyst verification':'Examine catalyst and stock reaction →'}</button>
  </div>
  <p className="chart-note"><strong>Filing classified as:</strong> {report.subjectLabel}. This subject alone does not establish positive materiality or market surprise.</p>
  <p className="chart-note"><strong>Broadly matching SEC/news event subjects:</strong> {report.sameSubjectHeadlines} related issuer headline(s). Topic overlap only, NOT independently corroborated article content. {report.preFilingSameSubjectHeadlines>0?'Some subject-related news predates the SEC filing.':''}</p>
  <p className="chart-note"><strong>Issuer-name-matched RSS coverage:</strong> {report.before} before filing · {report.sameDate} on filing date · {report.after} afterward{report.undated||report.future?' · '+(report.undated+report.future)+' unaligned':''}. Original article release times unverified.</p>
  {report.before>0&&<p className="opportunity-uncertainty"><strong>Possible pre-filing disclosure:</strong> Related news appears before the SEC filing date ({report.earliestHeadlineDate}). The market may already have known about this development; do not attribute the whole price move to the 8-K.</p>}
  {expanded&&<div className="atlas-catalyst-verification-details">
    {report.recognizedMetrics.length>0&&<details className="atlas-details"><summary>Review {report.recognizedMetrics.length} SEC-reported financial figure(s)</summary>
     {report.recognizedMetrics.map((metric,i)=><p key={i}><strong>{metric.label}:</strong> {metric.reportedValue}{metric.sourceUrl&&<> · <a href={metric.sourceUrl} target="_blank" rel="noopener noreferrer">SEC source ↗</a></>}</p>)}
    </details>}
    <div><strong>Acceptance-aligned completed-session market reaction</strong>
     <p className="chart-note">ATLAS reads the accession-matched EDGAR acceptance clock and independently retrieves daily IEX prices for {ticker} and SPY. Comparison is descriptive, not proof that the filing caused the move.</p>
     <FilingPriceContext ticker={ticker} eventDate={filingDate} sourceUrl={sourceUrl} autoLoad/>
    </div>
    <details className="atlas-details"><summary>What still prevents an event-driven bullish verdict?</summary>
     {report.notes.map((note,i)=><p key={i}>{note}</p>)}
     <p>Pre-filing analyst consensus, full article text, pre-announcement public disclosure and a complete issuer-specific fair valuation are still required before calling an opportunity mispriced.</p>
    </details>
   </div>}
 </section>;
}
