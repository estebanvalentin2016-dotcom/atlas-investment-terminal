// Compare exact matching completed sessions; never align benchmark by array index alone.
const good=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
export function benchmarkRelative(acceptedAt,stockBars,benchmarkBars,eventStudy){
 const stock=eventStudy(acceptedAt,stockBars);
 if(stock.status!=='aligned')return {status:stock.status,reason:stock.reason,stock,relative:{day1:null,day3:null,day5:null},continuation:{day3:null,day5:null}};
 const start=stockBars.findIndex(b=>b.date===stock.firstSession);
 const baseDate=stock.baselineSession;
 const benchmark=new Map(benchmarkBars.map(b=>[b.date,b.close]));
 const base=benchmark.get(baseDate),first=benchmark.get(stock.firstSession);
 const relative={},continuation={};
 for(const n of [1,3,5]){
  const window=stockBars.slice(start,start+n);
  const matched=window.length===n&&window.every(b=>good(benchmark.get(b.date)));
  const target=window.at(-1)?.date;
  const bClose=target?benchmark.get(target):null;
  const sReturn=stock.returns['day'+n];
  relative['day'+n]=matched&&good(base)&&good(bClose)&&typeof sReturn==='number'
   ?sReturn-(bClose/base-1)*100:null;
  if(n>1){
   const sCont=stock.continuation?.['day'+n];
   continuation['day'+n]=matched&&good(first)&&good(bClose)&&typeof sCont==='number'
    ?sCont-(bClose/first-1)*100:null;
  }
 }
 return {status:'measured',stock,relative,continuation,benchmark:'SPY',method:'simple-return percentage-point difference'};
}
