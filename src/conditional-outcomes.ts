// Empirical *historical* price-return references for an amount slider.
// Nothing here estimates forward probabilities, expected returns, or the
// likelihood that a current SEC catalyst will persist.
import type {HistoricalPriceResponse} from './price-history-model';
export type HorizonMonths=1|3|6|12;
export type OutcomeBand={label:'Historical lower decile'|'Historical median'|'Historical upper decile';returnPct:number;endingValue:number;profit:number};
export type ConditionalOutcomes={status:'available'|'unavailable';sampleCount:number;start:string|null;end:string|null;horizonMonths:HorizonMonths;amount:number;priceDate:string|null;
 bands:OutcomeBand[];severeStress:{returnPct:-50;endingValue:number;profit:number}|null;reason:string};
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const weeks:Record<HorizonMonths,number>={1:4,3:13,6:26,12:52};
const quantile=(a:number[],q:number)=>{const pos=(a.length-1)*q,l=Math.floor(pos),h=Math.ceil(pos);return a[l]+(a[h]-a[l])*(pos-l)};
const rounded=(n:number)=>Math.round(n*100)/100;
export function calculateConditionalOutcomes(history:HistoricalPriceResponse|null,amount:number,horizonMonths:HorizonMonths,asOf:string,priceDate:string|null):ConditionalOutcomes{
 const fail=(reason:string):ConditionalOutcomes=>({status:'unavailable',sampleCount:0,start:null,end:null,horizonMonths,amount,priceDate,bands:[],severeStress:null,reason});
 if(!Number.isFinite(amount)||amount<100||amount>50000)return fail('Enter a supported investment amount between $100 and $50,000.');
 if(!validDate(asOf)||!priceDate||!validDate(priceDate)||priceDate>asOf||(Date.parse(asOf+'T00:00:00Z')-Date.parse(priceDate+'T00:00:00Z'))>10*86400000)return fail('A recent completed price is required.');
 if(!history||history.provider!=='Alpaca'||history.feed!=='IEX'||history.adjustment!=='split'||history.timeframe!=='1Week'||!history.completedWeeksOnly||history.partialHistory)return fail('Complete split-adjusted weekly Alpaca IEX history is unavailable.');
 const bars=[...history.bars].filter(b=>validDate(b.date)&&b.date<asOf&&Number.isFinite(b.close)&&b.close>0).sort((a,b)=>a.date.localeCompare(b.date));
 const w=weeks[horizonMonths];
 if(bars.length<w+31||bars.some((b,i)=>i>0&&(b.date===bars[i-1].date||(Date.parse(b.date+'T00:00:00Z')-Date.parse(bars[i-1].date+'T00:00:00Z'))>16*86400000))return fail('Insufficient continuous weekly observations for historical outcome bands.');
 if((Date.parse(asOf+'T00:00:00Z')-Date.parse(bars.at(-1)!.date+'T00:00:00Z'))>21*86400000)return fail('Historical weekly price data are stale.');
 const values:number[]=[];
 for(let i=w;i<bars.length;i++){
  if(bars[i-w].close<=0)continue;
  values.push((bars[i].close/bars[i-w].close-1)*100);
 }
 if(values.length<30)return fail('Fewer than 30 overlapping historical observations available.');
 values.sort((a,b)=>a-b);
 const results:[OutcomeBand['label'],number][]=[['Historical lower decile',quantile(values,0.1)],['Historical median',quantile(values,0.5)],['Historical upper decile',quantile(values,0.9)]];
 const bands=results.map(([label,ret])=>({label,returnPct:rounded(ret),endingValue:rounded(amount*(1+ret/100)),profit:rounded(amount*ret/100)}));
 return {status:'available',sampleCount:values.length,start:bars[0].date,end:bars.at(-1)!.date,horizonMonths,amount,priceDate,bands,
  severeStress:{returnPct:-50,endingValue:rounded(amount*0.5),profit:rounded(-amount*0.5)},
  reason:'Historical overlapping weekly price windows, split-adjusted, exclude dividends, commissions, slippage and taxes. These distributions are NOT calibrated forecasts, outcome probabilities, or returns conditioned on today\'s SEC/news catalysts. Actual losses can exceed illustrated stress.'};
}
