type Statement={label:string;excerpt:string;sourceName?:string;sourceUrl?:string};
type Metric=Statement&{reportedValue:string};
export type FilingEvidenceResult={
 url:string;sourceStatus:'reviewed_text'|'partial_text'|'unavailable';
 httpStatus?:number;bytesRead?:number;declaredBytes?:number|null;limitBytes?:number;truncated?:boolean;
 reviewMethod?:'selected_documents';
 documents?:{role:string;name:string;url:string;status:string;error?:string;bytesRead?:number}[];
 sourceProblems?:string[];
 selection?:{primaryLocated:boolean;exhibitsListed:number;selectedExhibits:number};
 retrievedAt?:string;note:string;
 evidence?:{status:'mixed_claims'|'potential_language'|'no_positive_phrase_detected';potential:Statement[];cautions:Statement[];metrics?:Metric[];topics?:{code:string;label:string}[];textCharacters:number;limitations:string}|null;
};
export default function FilingEvidence({data,loading,onReview}:{data?:FilingEvidenceResult;loading:boolean;onReview:()=>void}){
 const metrics=data?.evidence?.metrics||[];
 const potential=data?.evidence?.potential||[];
 const cautions=data?.evidence?.cautions||[];
 const topics=data?.evidence?.topics||[];
 const reviewed=data?.sourceStatus!=='unavailable';
 return <div className="filing-evidence">
  <button type="button" className="button secondary" disabled={loading} onClick={onReview}>
   {loading?'Reading SEC documents…':data?'Refresh filing evidence':'Show the important numbers'}
  </button>
  {data&&<div className="filing-evidence-body">
   {!reviewed?<p className="opportunity-uncertainty"><strong>Could not read the SEC document.</strong> {data.note} {data.httpStatus?'(HTTP '+data.httpStatus+')':''} The filing is not classified.</p>:
   <>
    <div className="atlas-glance">
     <strong className="atlas-glance-title">What stands out</strong>
     {topics.length>0&&<p className="atlas-summary-line"><strong>Filing type:</strong> {topics.slice(0,2).map(t=>t.label).join(' + ')}{topics.length>2?' and more':''}</p>}
     {metrics.length>0?<div className="atlas-glance-cards">
      {metrics.slice(0,6).map((metric,i)=><div className="atlas-glance-card" key={metric.label+'-'+i}>
       <span className="atlas-glance-label">{metric.label}</span>
       <strong className="atlas-glance-value">{metric.reportedValue}</strong>
       {metric.sourceUrl&&<a className="atlas-glance-link" href={metric.sourceUrl} target="_blank" rel="noopener noreferrer">Check SEC source ↗</a>}
      </div>)}
     </div>:<p className="atlas-summary-line"><strong>No standard operating figures detected.</strong> The document could still contain significant news.</p>}
     {potential.length>0&&<p className="atlas-summary-line"><strong>{potential.length} phrase{potential.length===1?'':'s'} to investigate.</strong> These are unverified text matches, not buy signals.</p>}
     {cautions.length>0&&<p className="atlas-summary-line"><strong>{cautions.length} caution phrase{cautions.length===1?'':'s'} detected.</strong> Read the supporting passage before interpreting it.</p>}
    </div>
    <p className="atlas-summary-line"><strong>Investment conclusion: NOT YET.</strong> Reported growth does not establish an earnings surprise, fair value, or remaining upside.</p>
    {data.sourceStatus==='partial_text'&&<p className="opportunity-uncertainty"><strong>Incomplete source review.</strong> Some exhibits or later passages were not read. A missing match is not proof of no catalyst.</p>}
    {(potential.length>0||cautions.length>0)&&<details className="atlas-details">
     <summary>Read the catalyst and caution phrases ({potential.length+cautions.length})</summary>
     {potential.map((item,i)=><div key={'p'+i} className="filing-evidence-excerpt"><strong>Possible development: {item.label}</strong><p>{item.excerpt}</p>{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Read original document ↗</a>}</div>)}
     {cautions.map((item,i)=><div key={'c'+i} className="filing-evidence-excerpt"><strong>Caution: {item.label}</strong><p>{item.excerpt}</p>{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Read original document ↗</a>}</div>)}
    </details>}
    {metrics.length>0&&<details className="atlas-details">
     <summary>Show the original passages behind the numbers ({metrics.length})</summary>
     {metrics.map((item,i)=><div key={'m'+i} className="filing-evidence-excerpt"><strong>{item.label}: {item.reportedValue}</strong><p>{item.excerpt}</p>{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Source: {item.sourceName||'SEC document'} ↗</a>}</div>)}
    </details>}
    <details className="atlas-details">
     <summary>Documents, limits & technical details</summary>
     {topics.length>0&&<p><strong>SEC filing subjects:</strong> {topics.map(t=>t.label+' (Item '+t.code+')').join(' · ')}</p>}
     {data.documents?.map(doc=><p key={doc.url}><strong>{doc.role}:</strong> <a href={doc.url} target="_blank" rel="noopener noreferrer">{doc.name}</a> · {doc.status}{doc.error?' — '+doc.error:''}</p>)}
     <p><strong>Coverage:</strong> {data.note}</p>
     {data.selection&&<p>Exhibit 99 files listed: {data.selection.exhibitsListed}. Selected: {data.selection.selectedExhibits}.</p>}
     {data.sourceProblems?.map((problem,i)=><p key={i}>{problem}</p>)}
     <p className="chart-note">{data.evidence?.limitations||'Text extraction is incomplete; verify original filings.'}</p>
    </details>
   </>}
  </div>}
 </div>;
}
