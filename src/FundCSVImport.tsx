import {useState} from 'react';
import {parseProviderFundCSV,type FundProvider,type ImportedFundSnapshot} from './fund-csv-adapters';
const options:{id:FundProvider;fund:string;url:string}[]=[
 {id:'iShares',fund:'IVV',url:'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf'},
 {id:'SPDR',fund:'SPY',url:'https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy'},
 {id:'Vanguard',fund:'VOO',url:'https://investor.vanguard.com/investment-products/etfs/profile/voo'}
];
const number=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
export default function FundCSVImport(){
 const [provider,setProvider]=useState<FundProvider>('iShares');
 const [fund,setFund]=useState('IVV');
 const [url,setUrl]=useState(options[0].url);
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [snapshot,setSnapshot]=useState<ImportedFundSnapshot|null>(null);
 function choose(next:FundProvider){const preset=options.find(x=>x.id===next)!;setProvider(next);setFund(preset.fund);setUrl(preset.url);setSnapshot(null);setError('')}
 async function importCSV(){
  if(!file)return;
  setBusy(true);setSnapshot(null);setError('');
  try{
   if(file.size>9000000)throw Error('CSV is larger than 9 MB');
   const data=await file.text();
   setSnapshot(parseProviderFundCSV(data,provider,fund,url));
  }catch(e){setError(e instanceof Error?e.message:'Fund CSV cannot be parsed')}
  finally{setBusy(false)}
 }
 return <section className="atlas-fund-import">
  <div><strong>Import an official fund holdings CSV</strong><p><strong>Stage-one fund-level adapter:</strong> reads a CSV that you download from the fund provider. It does not silently scrape or guess the provider's holdings.</p></div>
  <div className="atlas-fund-fields">
   <label>Fund provider<select value={provider} onChange={e=>choose(e.target.value as FundProvider)}>{options.map(x=><option value={x.id} key={x.id}>{x.id}</option>)}</select></label>
   <label>Fund ticker<input value={fund} onChange={e=>setFund(e.target.value)} maxLength={15} aria-label="Official fund ticker"/></label>
   <label>Official provider source page<input value={url} onChange={e=>setUrl(e.target.value)} aria-label="Official fund source URL"/></label>
   <label>Downloaded holdings CSV<input type="file" accept=".csv,text/csv" onChange={e=>{setFile(e.target.files?.[0]??null);setSnapshot(null)}} aria-label="Choose downloaded official fund CSV"/></label>
  </div>
  <button className="button secondary" type="button" disabled={!file||busy} onClick={()=>void importCSV()}>{busy?'Reading your CSV…':'Read fund holdings CSV'}</button>
  {error&&<p className="opportunity-uncertainty" role="alert"><strong>Cannot import:</strong> {error}. Check that the file contains CUSIP or ISIN plus number of shares; XLSX requires conversion to CSV.</p>}
  {snapshot&&<div className="atlas-fund-loaded">
   <p className="atlas-summary-line"><strong>{snapshot.provider} {snapshot.fundId}:</strong> {snapshot.positions.length} CUSIP-linked holdings parsed · {snapshot.excluded} rows excluded.</p>
   <p className="chart-note"><strong>Holdings as of:</strong> {snapshot.asOfDate??'Missing from provided CSV; cannot date-align'} · <strong>Publication date:</strong> NOT VERIFIED. <strong>Source:</strong> user-supplied CSV, not a live authenticated feed. <a href={snapshot.sourceUrl} target="_blank" rel="noopener noreferrer">Official provider page ↗</a></p>
   <p className="opportunity-uncertainty"><strong>These positions do NOT count toward verified active consensus.</strong> Fund ownership may be passive/index-related. ATLAS has not validated completeness, release dates, affiliated fund relationships, or issuer strategy.</p>
   <details className="atlas-details"><summary>See first 15 CUSIP-linked fund holdings</summary>
    {snapshot.positions.slice(0,15).map((p,i)=><p key={p.cusip+'-'+i}><strong>{p.issuer}</strong> · {p.ticker||'no ticker'} · {p.cusip} · {number(p.shares)} shares · {p.weightPct===null?'weight unknown':p.weightPct.toFixed(2)+'% reported weight'}</p>)}
   </details>
  </div>}
 </section>;
}
