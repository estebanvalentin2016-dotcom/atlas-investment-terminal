// ATLAS economic significance: bounded, source-dated interpretation of what
// an 8-K *actually reports*, never a verified surprise, materiality finding,
// investment valuation, implied growth forecast or causal stock-price move.
import type {FilingEvidenceResult} from './FilingEvidence';
import type {SecCompany,Annual} from './ranking-model';

export type OperatingDirection='improvement'|'deterioration'|'descriptive';
export type EconomicSignal={
 category:'revenue_change'|'eps_change'|'client_inflows'|'client_outflows'|'aum';
 label:string;reportedValue:string;direction:OperatingDirection;changePct:number|null;
 sourceUrl:string;excerpt:string;
};
export type EconomicSignificance={
 status:'quantified_improvement'|'adverse_or_mixed'|'descriptive_only'|'unquantified'|'source_unavailable';
 signals:EconomicSignal[];
 annual:{fiscalYear:number;filed:string;revenue:number;reportedGrowthPct:number|null;fcf:number|null;fcfMarginPct:number|null}|null;
 sensitivity:{onePointAnnualFcf:number;threePointAnnualFcf:number}|null;
 incompleteSource:boolean;
 verifiedEarningsSurprise:false;independentNewsCorroboration:false;verifiedMateriality:false;fairValueImpact:false;
 limitations:string[];explanation:string;
};
const validDate=(s:string)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const round=(n:number)=>Math.round(n*100)/100;
const validAnnual=(x:Annual,asOf:string)=>x.form==='10-K'&&validDate(x.end)&&validDate(x.filed)&&x.end<=asOf&&x.filed<=asOf&&Number.isFinite(x.value);
function annualContext(company:SecCompany|null,ticker:string,asOf:string):EconomicSignificance['annual']{
 if(!company||company.ticker!==ticker||!company.source?.startsWith('https://data.sec.gov/api/xbrl/companyfacts/')||!validDate(asOf))return null;
 const revenue=company.metrics.find(m=>m.name==='Revenue');
 if(!revenue||revenue.quality==='alternative_revenue_concepts')return null;
 const list=revenue.values.filter(x=>validAnnual(x,asOf)&&x.value>0).sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed));
 const current=list[0];
 if(!current||(Date.parse(asOf+'T00:00:00Z')-Date.parse(current.filed+'T00:00:00Z'))>550*86400000)return null;
 const previous=list.find(x=>x.year===current.year-1&&x.value>0);
 const metric=(name:string)=>{
  const rows=(company.metrics.find(m=>m.name===name)?.values??[]).filter(x=>validAnnual(x,asOf)&&x.end===current.end).sort((a,b)=>b.filed.localeCompare(a.filed));
  return rows[0]?.value??null;
 };
 const operating=metric('Operating cash flow'),capex=metric('Capital expenditures');
 const fcf=operating!==null&&capex!==null&&capex>=0?operating-capex:null;
 return {fiscalYear:current.year,filed:current.filed,revenue:current.value,
  reportedGrowthPct:previous?round((current.value/previous.value-1)*100):null,
  fcf,fcfMarginPct:fcf===null?null:round(fcf/current.value*100)};
}
function parseMetric(metric:{label:string;reportedValue:string;excerpt:string;sourceUrl?:string},filingUrl:string):EconomicSignal|null{
 const label=metric.label,raw=metric.reportedValue?.trim()??'';
 // Direct SEC original filing or SEC exhibit only. No generated links to other sites.
 const url=metric.sourceUrl||filingUrl;
 if(!url.startsWith('https://www.sec.gov/Archives/edgar/data/'))return null;
 let category:EconomicSignal['category'],direction:OperatingDirection='descriptive',changePct:number|null=null;
 if(label==='Reported revenue growth'||label==='Reported EPS growth'){
  category=label==='Reported revenue growth'?'revenue_change':'eps_change';
  // The matched verb determines the sign. A bare "%" without its
  // surrounding directional assertion must never be interpreted as growth.
  const expression=category==='revenue_change'?
   /\b(\d{1,3}(?:\.\d+)?)\s*%\s+(increase|growth|decrease|decline|drop|reduction)\s+in\s+revenue\b/i:
   /\b(\d{1,3}(?:\.\d+)?)\s*%\s+(increase|growth|decrease|decline|drop|reduction)\s+in\s+(?:(?:year[- ]over[- ]year|as adjusted|adjusted|gaap|diluted|net)\s+){0,6}(?:eps|earnings\s+per\s+share)\b/i;
  const matched=raw.match(expression);
  if(!matched)return null;
  const n=Number(matched[1]);if(!Number.isFinite(n)||n>200)return null;
  direction=/^(increase|growth)$/i.test(matched[2])?'improvement':'deterioration';
  changePct=round(n*(direction==='improvement'?1:-1));
 }else if(label==='Reported net inflows'&&/\bnet inflows?\b/i.test(raw)){category='client_inflows';direction='descriptive'}
 else if(label==='Reported net outflows'&&/\bnet outflows?\b/i.test(raw)){category='client_outflows';direction='deterioration'}
 else if(label==='Reported assets under management'&&/\b(?:aum|assets under management)\b/i.test(raw)){category='aum'}
 else return null;
 return {category,label,reportedValue:raw,direction,changePct,sourceUrl:url,excerpt:metric.excerpt?.slice(0,400)??''};
}
export function assessEconomicSignificance(args:{ticker:string;filingUrl:string;asOf:string;review:FilingEvidenceResult|null;company:SecCompany|null}):EconomicSignificance{
 const {ticker,filingUrl,asOf,review,company}=args;
 const annual=annualContext(company,ticker,asOf);
 const incompleteSource=review?.sourceStatus!=='reviewed_text'||!!review?.truncated||review?.reviewMethod==='selected_documents';
 const limitations=[
  'Reported percentages may describe a quarter, year, adjusted measure or noncomparable accounting periods. Period and basis are not normalized across 8-K and annual SEC facts.',
  'A higher reported metric is not a surprise versus the pre-release analyst consensus or evidence of a change in future guidance.',
  'Original independent news content and initial public-release time are not verified; 8-K acceptance is not necessarily when the event became public.',
  'Economic impact on future profits, debt, dilution and per-share fair value cannot be inferred from these observations. No buy verdict or stock-return forecast is computed.'
 ];
 if(incompleteSource)limitations.unshift('Only selected or partial SEC source coverage was available; other exhibits and contextual disclosures may change interpretation.');
 if(!annual)limitations.push('Recent, issuer-wide, filed SEC fiscal revenue and same-year cash-flow context were not all established.');
 else limitations.push('The annual SEC revenue baseline is FY '+annual.fiscalYear+' filed '+annual.filed+'; it does NOT necessarily cover the same reporting period as the 8-K.');
 const basic={annual,incompleteSource,verifiedEarningsSurprise:false as const,independentNewsCorroboration:false as const,verifiedMateriality:false as const,fairValueImpact:false as const,limitations};
 if(!review||review.url!==filingUrl||review.sourceStatus==='unavailable'||!review.evidence||!validDate(asOf)){
  return {...basic,status:'source_unavailable',signals:[],sensitivity:null,explanation:'No usable accession-matched SEC evidence. ATLAS cannot measure an economic change.'};
 }
 // Deduplicate repeated primary/exhibit citations while keeping the
 // original source passage. A "growth" phrase alone is not a forecast.
 const found=(review.evidence.metrics??[]).map(m=>parseMetric(m,filingUrl)).filter((s):s is EconomicSignal=>s!==null);
 const unique=[...new Map(found.map(x=>[x.category+'|'+x.reportedValue+'|'+x.sourceUrl,x])).values()].slice(0,12);
 const positive=unique.some(s=>s.direction==='improvement');
 const negative=unique.some(s=>s.direction==='deterioration')||(review.evidence.cautions??[]).length>0;
 const status:EconomicSignificance['status']=negative?'adverse_or_mixed':positive?'quantified_improvement':unique.length?'descriptive_only':'unquantified';
 const sensitivity=annual&&annual.revenue>0?{onePointAnnualFcf:round(annual.revenue*0.01),threePointAnnualFcf:round(annual.revenue*0.03)}:null;
 const explanation=status==='quantified_improvement'?'A positive percentage change was explicitly reported in the SEC filing, but its period, recurring nature, market surprise and impact on valuation are not yet established.':
  status==='adverse_or_mixed'?'Adverse reported operating language or cash outflows are present; positive metrics must not override downside evidence.':
  status==='descriptive_only'?'Some SEC-reported figures are available, but no supported positive percent change or forward profit uplift is established.':
  'No quantitatively extractable operating change found in the reviewed source scope; material news may still be present elsewhere in the filing.';
 return {...basic,status,signals:unique,sensitivity,explanation};
}
