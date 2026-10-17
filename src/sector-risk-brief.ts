// Automated sector-specific SEC balance sheet triage. No inferred regulatory
// capital adequacy, credit rating, deposit safety, liquidity or fair value.
import type {SecCompany,Annual} from './ranking-model';
import {deriveSurvivalEvidence} from './survival-evidence';
export type RiskFact={value:number;end:string;filed:string;tag:string|null};
export type SectorRiskBrief={
 sector:'bank'|'general';status:'source_backed_partial'|'source_unavailable';
 headline:string;meaning:string;nextEvidence:string;asOf:string;
 balance:{assets:RiskFact|null;equity:RiskFact|null;deposits:RiskFact|null;loans:RiskFact|null;allowance:RiskFact|null};
 equityAssetsPct:number|null;depositsAssetsPct:number|null;loansAssetsPct:number|null;
 dilutedShareChangePct:number|null;source:string;warnings:string[];
};
export const isBankIssuer=(name:string)=>/\b(?:bancorp|bancshares|bancorporation|bank|banks|banking)\b/i.test(name);
const date=(s:string)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const allowed=new Set(['10-Q','10-K','10-Q/A','10-K/A']);
function fact(company:SecCompany,metric:string,asOf:string):RiskFact|null{
 const m=company.metrics.find(x=>x.name===metric);
 const rows=(m?.values??[]).filter((x:Annual)=>allowed.has(x.form)&&date(x.end)&&date(x.filed)&&x.end<=x.filed&&x.filed<=asOf&&
  x.end<=asOf&&Number.isFinite(x.value)&&x.value>=0&&/^\d{10}-\d{2}-\d{6}$/.test(x.accession))
  .sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed));
 if(!rows.length)return null;
 const top=rows[0];
 if(rows.some(x=>x.end===top.end&&x.accession===top.accession&&x.value!==top.value))return null;
 return {value:top.value,end:top.end,filed:top.filed,tag:m?.tag??top.tag??null};
}
const ratio=(n:RiskFact|null,d:RiskFact|null)=>n&&d&&d.value>0&&n.end===d.end?Math.round(n.value/d.value*10000)/100:null;
export function assessSectorRisk(company:SecCompany,asOf:string):SectorRiskBrief{
 const sector=isBankIssuer(company.name)?'bank':'general';
 const empty={assets:null,equity:null,deposits:null,loans:null,allowance:null};
 const warnings:string[]=[];
 const survival=deriveSurvivalEvidence(company,asOf);
 const dilutedShareChangePct=survival.weightedShareChangePct;
 const base={sector,asOf,source:company.source,dilutedShareChangePct};
 if(sector==='general')return {...base,status:'source_unavailable',balance:empty,equityAssetsPct:null,depositsAssetsPct:null,loansAssetsPct:null,
  headline:'Standard operating-company risk screen',meaning:'Operating cash flow and annual earnings do not by themselves establish financing coverage or competitive durability.',
  nextEvidence:'Reconcile dated obligations, ownership, industry competitive sources and forward valuation.',warnings};
 if(!date(asOf)||!company.source?.startsWith('https://data.sec.gov/')){
  return {...base,status:'source_unavailable',balance:empty,equityAssetsPct:null,depositsAssetsPct:null,loansAssetsPct:null,
   headline:'Bank capital information unavailable',meaning:'No verified SEC balance-sheet context was supplied. Bank soundness cannot be assessed.',
   nextEvidence:'ATLAS must retrieve dated balance-sheet, lending and regulatory capital evidence.',warnings:['SEC provenance or research date was not validated.']};
 }
 const assets=fact(company,'Latest total assets',asOf);
 const equity=fact(company,'Latest stockholders equity',asOf);
 const deposits=fact(company,'Latest customer deposits',asOf);
 const loans=fact(company,'Latest loans receivable',asOf);
 const allowance=fact(company,'Latest loan-loss allowance',asOf);
 const reference=assets;
 const withinDate=(f:RiskFact|null)=>f&&reference&&f.end===reference.end?f:null;
 const balance={assets,equity:withinDate(equity),deposits:withinDate(deposits),loans:withinDate(loans),allowance:withinDate(allowance)};
 const fresh=!!assets&&(Date.parse(asOf+'T00:00:00Z')-Date.parse(assets.end+'T00:00:00Z'))<=200*86400000;
 const equityAssetsPct=fresh?ratio(balance.equity,assets):null;
 const depositsAssetsPct=fresh?ratio(balance.deposits,assets):null;
 const loansAssetsPct=fresh?ratio(balance.loans,assets):null;
 if(!fresh)warnings.push('Recent assets could not be established from issuer-wide, dated SEC facts.');
 if(equityAssetsPct===null)warnings.push('Same-period book equity/assets unavailable. This ratio is not CET1 or regulatory capital adequacy.');
 if(depositsAssetsPct===null)warnings.push('Same-period deposits/assets unavailable. Deposit funding stability not assessed.');
 if(loansAssetsPct===null)warnings.push('Same-period loans/assets unavailable. Loan quality and credit losses not assessed.');
 warnings.push('Company name suggests a bank, but name is only a preliminary industry classifier. Verify regulatory status.');
 warnings.push('Bank financial statements use different liquidity and cash-flow economics. Cash ÷ FCF runway and extrapolated revenue/FCF growth are not bank solvency or fair-value measures.');
 warnings.push('Regulatory CET1, risk-weighted assets, uninsured deposits, NIM, nonperforming loans, provisioning, debt maturities and fair value remain unknown.');
 if(dilutedShareChangePct!==null&&Math.abs(dilutedShareChangePct)>=10)
  warnings.push('Annual weighted-average diluted shares changed '+dilutedShareChangePct.toFixed(1)+'%; may reflect issuance, acquisition or other structural changes. Not a verified dilution event.');
 return {...base,status:fresh&&equityAssetsPct!==null?'source_backed_partial':'source_unavailable',balance,equityAssetsPct,depositsAssetsPct,loansAssetsPct,
  headline:fresh&&equityAssetsPct!==null?'Bank balance-sheet proportions available; capital quality unverified':'Bank investment decision blocked by capital/credit evidence',
  meaning:equityAssetsPct!==null?'Book equity equals '+equityAssetsPct.toFixed(1)+'% of reported assets ('+assets!.end+'). This is NOT a regulatory CET1 ratio or proof of a safe investment.':
   'ATLAS cannot substantiate bank capital strength using a generic cash-runway or FCF screen.',
  nextEvidence:'ATLAS needs dated CET1/risk-weighted capital, deposit composition and stability, credit-loss quality, loan growth and sector-specific normalized earnings valuation before a bullish bank verdict.',
  warnings};
}
