import {deriveMarketCapEvidence} from './market-cap-evidence';
import type {MarketValuationClose,SecCompany} from './ranking-model';

const usd=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const count=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);

export default function MarketCapEvidencePanel({company,quote,asOf}:{company:SecCompany;quote:MarketValuationClose|null;asOf:string}){
 const e=deriveMarketCapEvidence(company,quote,asOf);
 return <section className="atlas-survival-panel" aria-label="Dated SEC capitalization and IEX liquidity evidence">
  <div className="atlas-survival-panel-head"><strong>Market capitalization &amp; trading evidence</strong><span>Source-dated · not investment-ready</span></div>
  <div className="atlas-survival-metrics">
   <div><span>Indicative equity value</span><strong>{usd(e.estimate)}</strong><small>Not a verified market cap</small></div>
   <div><span>SEC DEI reported common shares</span><strong>{count(e.shares?.value??null)}</strong><small>As of {e.shares?.end??'unknown'} · class coverage unverified</small></div>
   <div><span>20-session average IEX dollar turnover</span><strong>{usd(e.iex20?.avgDailyIexDollarVolume??null)}</strong><small>IEX only · not consolidated market liquidity</small></div>
   <div><span>20-session average IEX shares</span><strong>{count(e.iex20?.avgDailyIexShares??null)}</strong><small>{e.iex20?.startDate??'Unknown'} through {e.iex20?.endDate??'unknown'}</small></div>
  </div>
  <p className="opportunity-uncertainty"><strong>Capitalization status: {e.status}.</strong> Raw IEX close and SEC DEI dated count require share-class, split, current shares, float and venue reconciliation before the market-cap/liquidity gate can be verified.</p>
  <details className="atlas-details"><summary>Audit share-count provenance, dates and liquidity limits</summary>
   <p><strong>Quote:</strong> {quote?.price??'Unknown'} · completed IEX session {e.priceDate??'unknown'} · as-of {asOf} · raw price/split compatibility {quote?.splitValidation??'unverified'}.</p>
   <p><strong>SEC DEI:</strong> {e.shares?.value?.toLocaleString('en-US')??'Unavailable'} common shares · period {e.shares?.end??'unknown'} · filed {e.shares?.filed??'unknown'} · {e.shares?.form??'unknown'} · accession {e.shares?.accession??'unknown'}.</p>
   {e.notes.map((note,i)=><p key={i}>{note}</p>)}
   {e.source&&<p><a href={e.source} target="_blank" rel="noopener noreferrer">Original SEC issuer companyfacts ↗</a></p>}
  </details>
 </section>;
}
