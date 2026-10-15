export type MomentumInput={priorClose:number;latestClose:number;priorVolume:number;averageVolume:number};
export function assessMomentum(x:MomentumInput){
 if(Object.values(x).some(v=>!Number.isFinite(v)||v<=0))return null;
 return {returnPct:(x.latestClose/x.priorClose-1)*100,relativeVolume:x.priorVolume/x.averageVolume};
}
