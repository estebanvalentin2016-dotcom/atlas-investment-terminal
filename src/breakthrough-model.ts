export type EvidenceKind='Unverified hypothesis'|'Technical evidence'|'Commercial milestone'|'Contradictory evidence';
export type EvidenceRecord={id:string;title:string;sector:string;ticker:string;claim:string;url:string;date:string;kind:EvidenceKind;createdAt:string};
export function validEvidenceUrl(value:string){try{const u=new URL(value);return (u.protocol==='https:'||u.protocol==='http:')&&Boolean(u.hostname)}catch{return false}}
