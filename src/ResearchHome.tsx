import MonthlyPicksDashboard from './MonthlyPicksDashboard';
type Destination='Autonomous Discovery'|'Screener'|'Opportunity Radar'|'Company Research'|'Conviction Lab'|'Watchlist'|'Discovery Feed';
const stages:{number:string;title:string;purpose:string;cta:string;destination:Destination;status:string}[]=[
 {number:'01',title:'Discover',purpose:'Surface real SEC filings and companies worth investigating, not just fashionable tickers.',cta:'Discover Opportunities',destination:'Autonomous Discovery',status:'Zero ticker input · SEC universe scan'},
 {number:'02',title:'Investigate',purpose:'Check reported growth, free cash flow, balance-sheet signals and original public sources.',cta:'Research a company',destination:'Company Research',status:'Real SEC financial facts'},
 {number:'03',title:'Value',purpose:'Compare financial strength and current FY P/E before building full dilution-aware outcomes.',cta:'Open fundamentals ranking',destination:'Screener',status:'Weighted research ranking'},
 {number:'04',title:'Decide',purpose:'Ask whether a source-backed thesis and real valuation justify conviction—or whether evidence is missing.',cta:'Open Conviction Lab',destination:'Conviction Lab',status:'Evidence gates, not buy signals'},
 {number:'05',title:'Monitor',purpose:'Keep real watchlists, notes and research comparisons together for multi-year follow-up.',cta:'Open saved companies',destination:'Watchlist',status:'Local real-company watchlist'}
];
export default function ResearchHome({navigate,onConviction}:{navigate:(page:Destination)=>void;onConviction?:(ticker:string)=>void}){
 return <section className="atlas-research-home">
  <MonthlyPicksDashboard onConviction={onConviction} onOpportunity={()=>navigate('Opportunity Radar')}/>
  <details className="atlas-home-more">
   <summary>Explore other ATLAS research tools and methodology</summary>
  <div className="atlas-home-mission">
   <span className="eyebrow">ASYMMETRIC ALPHA / LONG-HORIZON RESEARCH</span>
   <h2>Find what could become <em>much more valuable.</em></h2>
   <p><strong>3–7 years. Evidence first. Price matters.</strong> ATLAS is being rebuilt around the difference between a great business and an attractive investment at today's valuation.</p>
   <button type="button" className="button primary" onClick={()=>navigate('Autonomous Discovery')}>Discover Opportunities →</button>
  </div>
  <div className="atlas-home-journey">
   {stages.map(stage=><article className="atlas-home-stage" key={stage.number}>
    <span className="atlas-stage-number">{stage.number}</span>
    <div><h3>{stage.title}</h3><p>{stage.purpose}</p><small>{stage.status}</small></div>
    <button type="button" className="button secondary" onClick={()=>navigate(stage.destination)}>{stage.cta} →</button>
   </article>)}
  </div>
  <div className="atlas-home-boundaries">
   <strong>The research standard</strong>
   <p>ATLAS must be able to say <strong>“Insufficient Evidence”</strong> or recommend no purchases. It will not invent return probabilities, claim that a news timestamp proves a stock reaction, or confuse VC backing with an undervalued share price.</p>
   <button type="button" className="button secondary" onClick={()=>navigate('Discovery Feed')}>Explore sectors and technology themes →</button>
  </div>
  </details>
 </section>;
}
