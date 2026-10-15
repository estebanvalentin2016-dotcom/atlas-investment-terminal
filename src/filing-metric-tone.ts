export type Tone='positive'|'negative'|'neutral';
export type TonedMetric={tone:Tone;headline:string;detail:string};
// Color only explicit directional business facts, never the investment conclusion.
export function toneForReportedMetric(label:string,raw:string):TonedMetric{
 const clean=raw.trim();
 const isPerformance=/(revenue|earnings|eps|free cash flow|operating income|profit|net inflows)/i.test(label);
 const pct=clean.match(/\b(\d+(?:\.\d+)?)\s*%\s+(increase|growth|decrease|decline|drop|fall|reduction)\b/i);
 if(pct&&isPerformance){
  const positive=/^(increase|growth)$/i.test(pct[2]);
  return {tone:positive?'positive':'negative',headline:(positive?'+':'−')+pct[1]+'%',detail:clean};
 }
 if(/net inflows/i.test(label)&&/\bnet inflows\b/i.test(clean))return {tone:'positive',headline:clean,detail:'Reported net inflows'};
 if(/net outflows/i.test(label)&&/\bnet outflows\b/i.test(clean))return {tone:'negative',headline:clean,detail:'Reported net outflows'};
 return {tone:'neutral',headline:clean,detail:'Reported figure'};
}
export function toneForReturn(n:number|null):Tone{return n===null||!Number.isFinite(n)?'neutral':n>0?'positive':n<0?'negative':'neutral'}
