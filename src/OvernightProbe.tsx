import {useState} from 'react';
type Result={status:string;reason?:string;barCount?:number;near2amBars?:number;observed2amWindow?:{timeEt:number;open:number;high:number;low:number;close:number;volume:number}[];partialHistory?:boolean;robinhoodHistoricalEligibility:string;executionPrice:string;error?:string};
export default function OvernightProbe({ticker,session}:{ticker:string;session:string}){
 const [value,setValue]=useState<Result|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 async function check(){
  setLoading(true);setError('');setValue(null);
  try{const r=await fetch('/api/market/overnight-probe?'+new URLSearchParams({ticker,session}));const result=await r.json() as Result;if(!r.ok)throw Error(result.error||'Probe unavailable');setValue(result)}
  catch(e){setError(e instanceof Error?e.message:'Could not check overnight data')}
  finally{setLoading(false)}
 }
 return <section className="overnight-probe">
  <h4>2:00 AM overnight opportunity research</h4>
  <p>Robinhood is your trading broker. Alpaca supplies historical market data only. This checks whether the Blue Ocean (BOATS) feed has historical observations around 2 AM Eastern on {session}.</p>
  <button type="button" className="button" onClick={check} disabled={loading}>{loading?'Checking overnight history…':'Check 2 AM historical data'}</button>
  {error&&<p role="alert" className="real-error">{error}</p>}
  {value&&<div className="overnight-results" role="status">
   <div className="overnight-lead"><strong>{value.status}</strong><span>{value.reason||'Historical overnight BOATS data, not Robinhood trade records'}</span></div>
   <div className="overnight-stats"><div><small>Overnight 15-min bars</small><strong>{value.barCount??'N/A'}</strong></div><div><small>Bars around 2 AM</small><strong>{value.near2amBars??'N/A'}</strong></div><div><small>Robinhood eligibility that night</small><strong>Unknown</strong></div></div>
   {value.observed2amWindow&&value.observed2amWindow.length>0&&<div className="overnight-observations"><strong>Observed BOATS intervals, 1:45–2:15 AM ET</strong>{value.observed2amWindow.map(b=><div key={b.timeEt}><span>{String(Math.floor(b.timeEt/60)).padStart(2,'0')}:{String(b.timeEt%60).padStart(2,'0')} ET</span><span>O {'</span><span>Volume {b.volume.toLocaleString()}</span></div>)}</div>}
   {value.partialHistory&&<p className="real-error">Provider reports partial history. Do not infer missing price movement.</p>}
   <p>Robinhood 24 Hour Market uses eligible symbols and whole-share limit orders. We cannot retrospectively establish Robinhood's symbol eligibility, available bid/ask, order acceptance, or fill using Alpaca bars.</p>
  </div>}
 </section>;
}
+b.open.toFixed(2)} · H {'</span><span>Volume {b.volume.toLocaleString()}</span></div>)}</div>}
   {value.partialHistory&&<p className="real-error">Provider reports partial history. Do not infer missing price movement.</p>}
   <p>Robinhood 24 Hour Market uses eligible symbols and whole-share limit orders. We cannot retrospectively establish Robinhood's symbol eligibility, available bid/ask, order acceptance, or fill using Alpaca bars.</p>
  </div>}
 </section>;
}
+b.high.toFixed(2)} · L {'</span><span>Volume {b.volume.toLocaleString()}</span></div>)}</div>}
   {value.partialHistory&&<p className="real-error">Provider reports partial history. Do not infer missing price movement.</p>}
   <p>Robinhood 24 Hour Market uses eligible symbols and whole-share limit orders. We cannot retrospectively establish Robinhood's symbol eligibility, available bid/ask, order acceptance, or fill using Alpaca bars.</p>
  </div>}
 </section>;
}
+b.low.toFixed(2)} · C {'</span><span>Volume {b.volume.toLocaleString()}</span></div>)}</div>}
   {value.partialHistory&&<p className="real-error">Provider reports partial history. Do not infer missing price movement.</p>}
   <p>Robinhood 24 Hour Market uses eligible symbols and whole-share limit orders. We cannot retrospectively establish Robinhood's symbol eligibility, available bid/ask, order acceptance, or fill using Alpaca bars.</p>
  </div>}
 </section>;
}
+b.close.toFixed(2)}</span><span>Volume {b.volume.toLocaleString()}</span></div>)}</div>}
   {value.partialHistory&&<p className="real-error">Provider reports partial history. Do not infer missing price movement.</p>}
   <p>Robinhood 24 Hour Market uses eligible symbols and whole-share limit orders. We cannot retrospectively establish Robinhood's symbol eligibility, available bid/ask, order acceptance, or fill using Alpaca bars.</p>
  </div>}
 </section>;
}
