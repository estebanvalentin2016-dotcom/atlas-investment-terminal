export type MacroEventType = 'cpi' | 'employment' | 'fomc';
export type MacroObservation = {key:string;value:number;unit:'percent'|'persons';sourceCaption:string|null;status:'reported'};
export type OfficialMacroRecord = {
 schemaVersion:1;id:string;eventType:MacroEventType;status:'official_observation';
 source:{agency:string;url:string;publishedAt:string;publishedTimeZone:string;publicationTimeBasis:'official_for_release_at'|'official_embargo_until';retrievedAt:string};
 referencePeriod:string;observations:MacroObservation[];observationStatus:'reported'|'unknown';
 revision:{status:'revised'|'unknown';publishedAt:string|null;note:string|null};
 possibleTransmissionMechanism:null;companySpecificEvidence:null;analystInterpretation:null;uncertainty:string[];
};
export type MacroUnavailable = {status:'unavailable';reason:string;httpStatus?:number};
export function normalizeOfficialMacroEvidence(input:Record<string,unknown>):OfficialMacroRecord|MacroUnavailable;
export function appendMacroEvidence(existing:OfficialMacroRecord[],record:OfficialMacroRecord|MacroUnavailable):OfficialMacroRecord[];
export function macroEvidenceAsOf(records:OfficialMacroRecord[],assessmentAt:string):OfficialMacroRecord[];
export function ingestOfficialMacroRelease(options:{eventType:MacroEventType;sourceUrl?:string;fetchImpl?:Function;now?:()=>Date}):Promise<OfficialMacroRecord|MacroUnavailable>;
