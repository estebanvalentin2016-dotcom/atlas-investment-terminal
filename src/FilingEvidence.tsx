export type FilingEvidenceResult={url:string;sourceStatus:'reviewed_text'|'partial_text'|'unavailable';httpStatus?:number;bytesRead?:number;declaredBytes?:number|null;limitBytes?:number;truncated?:boolean;retrievedAt?:string;note:string;evidence?:{status:'mixed_claims'|'potential_language'|'no_positive_phrase_detected';potential:{label:string;excerpt:string}[];cautions:{label:string;excerpt:string}[];textCharacters:number;limitations:string}|null};
export default function FilingEvidence({data,loading,onReview}:{data?:FilingEvidenceResult;loading:boolean;onReview:()=>void}){
 return <div className="filing-evidence">
  <button type="button" className="button secondary" disabled={loading} onClick={onReview}>{loading?'Reviewing SEC filing…':data?'Review filing again':'Review filing evidence'}</button>
  {data&&<div className="filing-evidence-body">
   {data.sourceStatus==='unavailable'?<p className="opportunity-uncertainty"><strong>Source unavailable:</strong> {data.note}{data.httpStatus?' (SEC HTTP '+data.httpStatus+')':''}. No bullish conclusion can be drawn.</p>:
   <>{data.sourceStatus==='partial_text'&&<p className="opportunity-uncertainty"><strong>Partial evidence only:</strong> {data.note}{data.declaredBytes!=null?' · SEC declared '+data.declaredBytes.toLocaleString()+' bytes':''}. Do not interpret missing keyword matches as a negative result.</p>}<strong>{data.evidence?.status==='mixed_claims'?'Mixed language — review both sides':data.evidence?.status==='potential_language'?'Potentially favorable language found — unverified':data.sourceStatus==='partial_text'?'No favorable phrase in reviewed portion — incomplete':'No matching favorable phrases found'}</strong>
    <p className="chart-note">This is literal phrase detection, not a verified bullish catalyst. Context, materiality, prior publication, valuation and observed price reaction remain unknown.</p>
    {data.evidence?.potential.map((item,i)=><div key={'p'+i} className="filing-evidence-excerpt"><strong>Review: {item.label}</strong><p>{item.excerpt}</p></div>)}
    {data.evidence?.cautions.map((item,i)=><div key={'c'+i} className="filing-evidence-excerpt"><strong>Caution: {item.label}</strong><p>{item.excerpt}</p></div>)}
    {!data.evidence?.potential.length&&<p className="chart-note">No positive pattern detected. This does not prove the disclosure is immaterial or bearish.</p>}
   </>}
  </div>}
 </div>;
}
