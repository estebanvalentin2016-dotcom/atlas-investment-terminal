import type {PriceBar} from './filing-price-context';
export type MomentumObservation={ticker:string;return5:number|null;spyReturn5:number|null;relative5:number|null;asOf:string|null;reason:string};
const round=(n:number)=>Math.round(n*100)/100;
export function fiveSessionRelative(ticker:string,input:PriceBar[],spyInput:PriceBar[]):MomentumObservation{
 const bars=input.filter(x=>x&&Number.isFinite(x.close)&&x.close>0&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)).slice().sort((a,b)=>a.date.localeCompare(b.date));
 const fail=(reason:string):MomentumObservation=>({ticker,return5:null,spyReturn5:null,relative5:null,asOf:null,reason});
 if(bars.length<6)return fail('At least six completed IEX daily closes are required');
 const end=bars.at(-1)!,begin=bars.at(-6)!;
 const ret=round((end.close/begin.close-1)*100);
 const spy=new Map(spyInput.map(x=>[x.date,x]));
 const bs=spy.get(begin.date),es=spy.get(end.date);
 if(!bs||!es||!Number.isFinite(bs.close)||bs.close<=0||!Number.isFinite(es.close)||es.close<=0)return {ticker,return5:ret,spyReturn5:null,relative5:null,asOf:end.date,reason:'Matching SPY completed sessions unavailable'};
 const sr=round((es.close/bs.close-1)*100);
 return {ticker,return5:ret,spyReturn5:sr,relative5:round(ret-sr),asOf:end.date,reason:'Measured sector/ticker proxy price momentum only; not a prediction or keyword-sentiment score'};
}
