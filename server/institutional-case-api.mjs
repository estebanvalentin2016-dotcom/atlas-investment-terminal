// Point-in-time, on-demand historical SEC verification.
// Expected figures below were transcribed independently from the original
// 2026-05-15 and 2026-08-14 SEC complete-submission documents.
import {retrieve13FInformationTable,retrieve13FCoverage,compare13FHoldings} from './institutional-api.mjs';
const CIK='1418814';
export const HISTORICAL_VALUEACT={
 manager:'ValueAct Holdings, L.P.',cik:CIK,
 latest:{form:'13F-HR',accession:'0001418814-26-000003',period:'2026-06-30',filed:'2026-08-14'},
 previous:{form:'13F-HR',accession:'0001418814-26-000002',period:'2026-03-31',filed:'2026-05-15'},
 expected:[
  {ticker:'RKT',issuer:'ROCKET COS INC',key:'77311W101|COM CL A',earlier:28214724,later:41668774},
  {ticker:'BLK',issuer:'BLACKROCK INC',key:'09290D101|COM',earlier:546100,later:581700},
  {ticker:'MDB',issuer:'MONGODB INC',key:'60937P106|CL A',earlier:1037800,later:165700},
  {ticker:'RBLX',issuer:'ROBLOX CORP',key:'771049103|CL A',earlier:5848621,later:3147421}
 ]
};
const cache=new Map();
export async function verifyValueActCase(){
 const cached=cache.get('valueact');
 if(cached&&Date.now()-cached.at<3600000)return cached.result;
 const agent=process.env.SEC_USER_AGENT;
 if(!agent||!agent.includes('@'))throw Error('SEC_USER_AGENT not configured');
 const headers={'User-Agent':agent,Accept:'application/json,application/xml,text/xml,text/plain'};
 const c=HISTORICAL_VALUEACT;
 const [current,prior,cover]=await Promise.all([
  retrieve13FInformationTable(c.latest,c.cik,headers),
  retrieve13FInformationTable(c.previous,c.cik,headers),
  retrieve13FCoverage(c.latest,c.cik,headers)
 ]);
 const rows=compare13FHoldings(current.holdings,prior.holdings);
 const checks=c.expected.map(x=>{
  const row=rows.find(r=>r.key===x.key);
  const ok=!!row&&row.shares===x.later&&row.previousShares===x.earlier&&row.issuer===x.issuer;
  return {ticker:x.ticker,issuer:x.issuer,cusip:x.key.split('|')[0],className:x.key.split('|')[1],
   priorReported:x.earlier,latestReported:x.later,
   delta:x.later-x.earlier,checked:ok,observedPrior:row?.previousShares??null,observedLatest:row?.shares??null,
   latestReportedValueDollars:row?.valueDollars??null,percentChange:x.earlier>0?Math.round((x.later/x.earlier-1)*10000)/100:null};
 });
 const other=cover.otherIncludedManagers.find(x=>x.cik==='1351069');
 const validCover=cover.reportType==='13F COMBINATION REPORT'&&!!other;
 const passed=checks.every(x=>x.checked)&&validCover&&current.holdings.length>0&&prior.holdings.length>0;
 const result={status:passed?'verified_against_live_sec':'verification_incomplete',manager:c.manager,cik:c.cik,
  sources:{latest:{...c.latest,informationTableUrl:current.tableUrl},previous:{...c.previous,informationTableUrl:prior.tableUrl},coverUrl:cover.sourceUrl},
  checks,managerAffiliation:{reportType:cover.reportType,otherIncludedManager:other||null,verifiedFromCover:validCover,
    inference:'ValueAct Capital Management is identified inside this ValueAct filing. Do NOT double-count these related managers as independently convicted buyers.'},
  coverage:{latestRows:current.rows,previousRows:prior.rows,excludedLatest:current.excluded,excludedPrevious:prior.excluded},
  timing:'Two quarter-end holdings snapshots, filed May 15 and August 14, 2026. Exact transaction dates and investor motives are not established.',
  interpretation:'A share-count increase is NOT proof of an actual purchase date or attractive investment. Split and corporate-action checks, current fundamentals and valuation remain separate.',
  inspectedAt:new Date().toISOString()};
 if(passed){cache.set('valueact',{at:Date.now(),result});}
 return result;
}
export async function handleInstitutionalCase(req,res){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname!=='/api/institutions/historical-case')return false;
 const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(req.method!=='GET'){reply(405,{error:'Method not allowed'});return true}
 try{const result=await verifyValueActCase();reply(result.status==='verified_against_live_sec'?200:503,result)}
 catch(e){reply(503,{status:'unavailable',error:e instanceof Error?e.message:'SEC verification unavailable',note:'No historical comparison validated in this session.'})}
 return true;
}
