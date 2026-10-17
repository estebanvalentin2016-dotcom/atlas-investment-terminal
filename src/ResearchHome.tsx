import MonthlyPicksDashboard from './MonthlyPicksDashboard';
type Destination='Autonomous Discovery'|'Screener'|'Opportunity Radar'|'Company Research'|'Conviction Lab'|'Watchlist'|'Discovery Feed';
export default function ResearchHome({navigate,onConviction}:{navigate:(page:Destination)=>void;onConviction?:(ticker:string)=>void}){
 return <section className="atlas-research-home"><MonthlyPicksDashboard onConviction={onConviction} onOpportunity={()=>navigate('Opportunity Radar')}/><div className="workspace-home-shortcuts"><button className="button secondary" onClick={()=>navigate('Autonomous Discovery')}>Discover Opportunities</button><button className="button secondary" onClick={()=>navigate('Watchlist')}>Review saved research</button></div></section>;
}
