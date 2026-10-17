// Descriptive intraday checkpoints, not executable entry signals or a backtest.
const checkpoints=[['09:45',585],['10:00',600],['10:30',630]];
const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
export function entryWindows(bars,fullRegularSession,partialHistory){
 const empty=checkpoints.map(([time])=>({time,status:'Unavailable',reference:null,toClose:null,highest:null,lowest:null}));
 if(!fullRegularSession||partialHistory||!Array.isArray(bars))return empty;
 if(bars.length!==26||bars.some((b,i)=>b.timeEt!==(String(Math.floor((570+i*15)/60)).padStart(2,'0')+':'+String((570+i*15)%60).padStart(2,'0'))||![b.open,b.high,b.low,b.close].every(valid)||b.high<b.low||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)))return empty;
 return checkpoints.map(([time,minute])=>{
  const i=(minute-570)/15;
  const reference=bars[i-1].close; // PREVIOUS bar has completed at the checkpoint.
  const later=bars.slice(i); // only intervals starting at/after checkpoint.
  const close=bars.at(-1).close;
  return {time,status:'Measured',reference,toClose:(close/reference-1)*100,highest:(Math.max(...later.map(b=>b.high))/reference-1)*100,lowest:(Math.min(...later.map(b=>b.low))/reference-1)*100};
 });
}
