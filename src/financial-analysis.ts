export type AnnualPoint={year:number;end:string;value:number;filed:string;tag?:string};
export type FinancialMetric={name:string;unit:string;values:AnnualPoint[];tag:string|null};
export type Derived={label:string;value:number|null;unit:'percent';detail:string};
export function matchedValues(a:FinancialMetric|undefined,b:FinancialMetric|undefined){
 if(!a||!b)return null;
 const first=a.values[0];
 if(!first)return null;
 const other=b.values.find(v=>v.end===first.end);
 return other?{a:first.value,b:other.value,end:first.end}:null;
}
export function financialAnalysis(metrics:FinancialMetric[]):Derived[]{
 const get=(name:string)=>metrics.find(m=>m.name===name);
 const revenue=get('Revenue'),income=get('Net income'),cash=get('Operating cash flow');
 const latest=revenue?.values[0];const previous=revenue?.values[1];
 const comparable=latest&&previous&&latest.value>0&&previous.value>0&&latest.end>previous.end;
 const yearInterval=comparable?(Date.parse(latest.end)-Date.parse(previous.end))/(365.25*86400000):0;
 const yoy=comparable&&yearInterval>=0.75&&yearInterval<=1.25?(latest.value/previous.value-1)*100:null;
 const historical=revenue?.values.find(v=>v.year===((latest?.year??0)-3)&&v.value>0);
 const cagr=latest&&historical&&latest.value>0&&historical.value>0&&latest.year-historical.year===3? (Math.pow(latest.value/historical.value,1/3)-1)*100:null;
 const net=matchedValues(income,revenue);
 const op=matchedValues(cash,revenue);
 const margin=(pair:ReturnType<typeof matchedValues>)=>pair&&pair.b>0?pair.a/pair.b*100:null;
 return [
 {label:'Revenue growth YoY',value:yoy,unit:'percent',detail:'Latest comparable annual periods'},
 {label:'Revenue CAGR (3Y)',value:cagr,unit:'percent',detail:'Three fiscal-year intervals'},
 {label:'Net income margin',value:margin(net),unit:'percent',detail:net?'Matched fiscal year end '+net.end:'No matching reported period'},
 {label:'Operating cash flow / revenue',value:margin(op),unit:'percent',detail:op?'Cash flow is before capital expenditures':'No matching reported period'}
 ];
}
