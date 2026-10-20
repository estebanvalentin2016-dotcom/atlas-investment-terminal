import {fetchSecJson,publicSecError} from './sec-request-client.mjs';
const SEC_ROOT='https://data.sec.gov';
const TICKERS='https://www.sec.gov/files/company_tickers.json';
const ttl=30*60*1000;
const REVENUE_TAGS=['Revenues','RevenueFromContractWithCustomerExcludingAssessedTax','RevenueFromContractWithCustomerIncludingAssessedTax','RevenueFromContractWithCustomer','SalesRevenueNet'];
export function secIndustryClassification(submission,source,retrievedAt,reason='SEC submissions metadata did not include a valid SIC code and description'){
 const rawCode=submission?.sic;
 const code=(typeof rawCode==='string'||typeof rawCode==='number')?String(rawCode).trim():'';
 const description=typeof submission?.sicDescription==='string'?submission.sicDescription.trim():'';
 if(/^\d{4}$/.test(code)&&description)return {status:'reported',system:'SEC SIC',code,description,source,retrievedAt};
 return {status:'unavailable',system:'SEC SIC',code:null,description:null,source,retrievedAt,reason};
}
export function annualValues(fact,unit='USD'){
 const entries=fact?.units?.[unit]||[];
 const byYear=new Map();
 for(const v of entries){
  if(v.form!=='10-K'||v.fp!=='FY'||!v.end||!v.filed||!Number.isFinite(v.val))continue;
  if(v.start){const duration=(Date.parse(v.end)-Date.parse(v.start))/86400000;if(duration<300||duration>400)continue;}
  const year=Number(v.end.slice(0,4));
  if(!Number.isInteger(year))continue;
  const prior=byYear.get(year);
  if(!prior||v.filed>prior.filed)byYear.set(year,{year,end:v.end,filed:v.filed,value:v.val,form:v.form,accession:v.accn});
 }
 return [...byYear.values()].sort((a,b)=>b.year-a.year).slice(0,4);
}
// Prefer a consistent accounting concept, but fill genuinely missing fiscal years
// with lower-priority concepts. Never add distinct revenue tags together.
export function selectFact(facts,tags,unit='USD'){
 const byYear=new Map();
 let chosenTag=null;
 for(const tag of tags){
  const annual=annualValues(facts?.['us-gaap']?.[tag],unit);
  for(const item of annual){
   if(!byYear.has(item.year)){
    byYear.set(item.year,{...item,tag});
    if(chosenTag===null)chosenTag=tag;
   }
  }
 }
 const values=[...byYear.values()].sort((a,b)=>b.year-a.year).slice(0,4);
 return {tag:values.length?values[0].tag:null,values};
}
// Never splice an issuer's smaller business segment into another year's
// total-revenue series. Prefer the largest eligible standardized annual revenue
// concept and keep ALL comparison years from that SAME SEC tag.
export function selectConsolidatedRevenue(facts){
 const tags=REVENUE_TAGS;
 const available=tags.map(tag=>({tag,values:annualValues(facts?.['us-gaap']?.[tag])})).filter(x=>x.values.length);
 if(!available.length)return {tag:null,values:[],quality:'missing',selectionNote:'No supported US-GAAP revenue fact found'};
 const year=Math.max(...available.flatMap(x=>x.values.map(v=>v.year)));
 const current=available.filter(x=>x.values.some(v=>v.year===year));
 current.sort((a,b)=>{
  const va=a.values.find(v=>v.year===year)?.value??0;
  const vb=b.values.find(v=>v.year===year)?.value??0;
  return vb-va||tags.indexOf(a.tag)-tags.indexOf(b.tag);
 });
 const chosen=current[0];
 const value=chosen.values.find(v=>v.year===year)?.value??0;
 const conflicting=current.filter(x=>{
  if(x.tag===chosen.tag)return false;
  const other=x.values.find(v=>v.year===year)?.value??0;
  return other>0&&value>0&&other/value<0.7;
 });
 return {
  tag:chosen.tag,values:chosen.values,
  quality:conflicting.length?'alternative_revenue_concepts':'selected_standard_revenue_tag',
  selectionNote:conflicting.length?'Other SEC revenue tags report materially smaller amounts for the same fiscal year. Those may be business segments, not consolidated sales. Review the source filing.':'One consistently tagged annual revenue series; still verify issuer totals against the 10-K',
  alternativeTags:conflicting.map(x=>x.tag)
 };
}
// DEI reports point-in-time entity common shares, unlike FY weighted-average
// diluted shares. The SEC companyfacts feed can omit class/dimensional data,
// so an observed count is not a verified date-matched equity denominator.
export function instantOutstandingShares(facts){
 const raw=facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares;
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 const seen=new Set();
 const values=(Array.isArray(raw)?raw:[]).filter(v=>
  ['10-K','10-Q','10-K/A','10-Q/A'].includes(v.form)&&
  !v.start&&validDate(v.end)&&validDate(v.filed)&&v.filed>=v.end&&
  Number.isSafeInteger(v.val)&&v.val>0&&v.val<=1e13&&
  typeof v.accn==='string'&&/^\d{10}-\d{2}-\d{6}$/.test(v.accn)
 ).map(v=>({year:Number(v.end.slice(0,4)),end:v.end,filed:v.filed,value:v.val,form:v.form,accession:v.accn,tag:'EntityCommonStockSharesOutstanding'}))
 .filter(v=>{const key=[v.end,v.filed,v.accession,v.value].join('|');if(seen.has(key))return false;seen.add(key);return true})
 .sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed)||b.accession.localeCompare(a.accession)).slice(0,24);
 return {tag:values.length?'EntityCommonStockSharesOutstanding':null,values,
  quality:values.length?'unreconciled_sec_entity_shares':'missing',
  selectionNote:'SEC DEI point-in-time count; number of share classes, entity-wide coverage, splits and current tradable float are not verified.'};
}
// Point-in-time 10-Q / 10-K balance-sheet facts. Never mix these with
// annual duration observations or silently equate a missing tag with zero.
export function latestInstantFact(facts,tags,unit='USD'){
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 const entries=[];
 for(const tag of tags){
  for(const v of facts?.['us-gaap']?.[tag]?.units?.[unit]||[]){
   if(!['10-Q','10-K','10-Q/A','10-K/A'].includes(v.form)||v.start||!validDate(v.end)||!validDate(v.filed)||
    v.end>v.filed||!Number.isFinite(v.val)||v.val<0||typeof v.accn!=='string'||!/^\d{10}-\d{2}-\d{6}$/.test(v.accn))continue;
   entries.push({year:Number(v.end.slice(0,4)),end:v.end,filed:v.filed,value:v.val,form:v.form,accession:v.accn,tag});
  }
 }
 const unique=new Map(entries.map(x=>[[x.tag,x.end,x.filed,x.accession,x.value].join('|'),x]));
 const values=[...unique.values()].sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed)||tags.indexOf(a.tag)-tags.indexOf(b.tag)).slice(0,20);
 return {tag:values[0]?.tag??null,values,quality:values.length?'dated_balance_sheet_observations':'missing',
  selectionNote:'10-Q/10-K instant GAAP observations; only facts public by the chosen as-of date count. Values are NOT complete funding or debt maturity disclosures.'};
}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
// Stable, broad ticker enumeration. No seed list or ticker inputs. The
// multiplicative CIK+symbol sort scatters batch order rather than exclusively
// scanning the alphabetically first slice of the SEC index.
export function enumerateTickerUniverse(index,cursor=0,limit=24){
 const seen=new Set();
 const rows=Object.values(index||{}).filter(row=>{
  const ticker=String(row?.ticker||'').trim().toUpperCase();
  const cik=Number(row?.cik_str);
  if(!/^[A-Z0-9.-]{1,12}$/.test(ticker)||!Number.isSafeInteger(cik)||cik<=0||!String(row?.title||'').trim()||seen.has(ticker))return false;
  seen.add(ticker);
  return true;
 }).map(row=>{
  const ticker=String(row.ticker).trim().toUpperCase();
  const cik=Number(row.cik_str);
  let hash=cik>>>0;
  for(const ch of ticker)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
  return {ticker,name:row.title,cik,order:hash>>>0};
 }).sort((a,b)=>a.order-b.order||a.ticker.localeCompare(b.ticker));
 const total=rows.length;
 const start=total?Math.min(Math.max(0,cursor),total-1):0;
 const selected=rows.slice(start,start+limit).map(({ticker,name,cik})=>({ticker,name,cik}));
 return {total,start,nextCursor:total?((start+selected.length)%total):0,completedCycle:total>0&&start+selected.length>=total,rows:selected};
}
export async function handleSecRequest(req,res){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/autonomous/universe'){
  if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return true}
  const cursorRaw=url.searchParams.get('cursor')||'0';
  const limitRaw=url.searchParams.get('limit')||'24';
  if(!/^\d{1,7}$/.test(cursorRaw)||!/^\d{1,2}$/.test(limitRaw)||Number(limitRaw)<1||Number(limitRaw)>30){json(res,400,{error:'Invalid scanner cursor or batch limit'});return true}
  try{
   const index=await fetchSecJson(TICKERS,{cacheTtlMs:ttl});
   const page=enumerateTickerUniverse(index.data,Number(cursorRaw),Number(limitRaw));
   json(res,200,{...page,provider:'SEC public ticker index',indexUrl:TICKERS,retrievedAt:index.retrievedAt,sourceCacheStatus:index.cacheStatus,scope:'SEC-indexed ticker universe, not verified exchange/sector eligibility; batch scanning is incomplete until all index rows are examined',seedTickersUsed:false});
  }catch(e){json(res,503,{...publicSecError(e,'SEC ticker universe unavailable'),coverage:'No universe scan performed'})}
  return true;
 }
 if(url.pathname==='/api/sec/search'){
  if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return true}
  const query=(url.searchParams.get('q')||'').trim().toLowerCase();
  if(query.length<1||query.length>80){json(res,400,{error:'Search for a ticker or company name (1–80 characters)'});return true}
  try{
   const index=await fetchSecJson(TICKERS,{cacheTtlMs:ttl});
   const candidates=Object.values(index.data).filter(x=>typeof x.ticker==='string'&&typeof x.title==='string');
   const entries=candidates.filter(x=>x.ticker.toLowerCase().includes(query)||x.title.toLowerCase().includes(query))
    .sort((a,b)=>{
     const score=x=>(x.ticker.toLowerCase()===query?0:x.ticker.toLowerCase().startsWith(query)?1:x.title.toLowerCase().startsWith(query)?2:3);
     return score(a)-score(b)||a.ticker.localeCompare(b.ticker)
    }).slice(0,15).map(x=>({ticker:x.ticker,name:x.title,cik:x.cik_str}));
   json(res,200,{provider:'SEC company ticker index',query,items:entries,retrievedAt:index.retrievedAt,sourceCacheStatus:index.cacheStatus});
  }catch(e){json(res,503,publicSecError(e,'SEC company search unavailable'))}
  return true;
 }
 if(url.pathname!=='/api/sec/company')return false;
 if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return true;}
 const ticker=(url.searchParams.get('ticker')||'').toUpperCase().trim();
 if(!/^[A-Z0-9.\-]{1,12}$/.test(ticker)){json(res,400,{error:'Enter a valid ticker symbol'});return true;}
 try{
  const index=await fetchSecJson(TICKERS,{cacheTtlMs:ttl});
  const match=Object.values(index.data).find(c=>c.ticker?.toUpperCase()===ticker);
  if(!match){json(res,404,{error:'Ticker not found in SEC company ticker list'});return true;}
  const cik=String(match.cik_str).padStart(10,'0');
  const source=SEC_ROOT+'/api/xbrl/companyfacts/CIK'+cik+'.json';
  const classificationSource=SEC_ROOT+'/submissions/CIK'+cik+'.json';
  const [factsResult,submissionResult]=await Promise.all([
   fetchSecJson(source,{cacheTtlMs:ttl}),
   fetchSecJson(classificationSource,{cacheTtlMs:ttl}).then(value=>({value,error:null}),error=>({value:null,error}))
  ]);
  const facts=factsResult.data,retrievedAt=factsResult.retrievedAt;
  const classification=secIndustryClassification(
   submissionResult.value?.data,classificationSource,submissionResult.value?.retrievedAt||retrievedAt,
   submissionResult.error instanceof Error?submissionResult.error.message:'SEC submissions metadata unavailable'
  );
  const revenueSelection=selectConsolidatedRevenue(facts.facts);
  const revenuePeriod=revenueSelection.values[0];
  const broaderCapex=annualValues(facts.facts?.['us-gaap']?.PaymentsToAcquireProductiveAssets)
   .find(value=>value.end===revenuePeriod?.end&&value.accession===revenuePeriod?.accession);
  const metrics=[
   ['Revenue',['Revenues']],
   ['Net income',['NetIncomeLoss']],
   ['Diluted EPS',['EarningsPerShareDiluted','EarningsPerShareBasicAndDiluted']],
   ['Operating cash flow',['NetCashProvidedByUsedInOperatingActivities']],
   ['Capital expenditures',['PaymentsToAcquirePropertyPlantAndEquipment']],
   ['Total assets',['Assets']],
   // Survival research: annual fiscal-period-aligned facts only. Debt
   // components are individually sourced; missing parts are NOT zero.
   ['Cash and cash equivalents',['CashAndCashEquivalentsAtCarryingValue']],
   ['Current portion of long-term debt',['LongTermDebtCurrent']],
   ['Long-term debt noncurrent',['LongTermDebtNoncurrent']],
   ['Short-term borrowings',['ShortTermBorrowings']],
   ['Weighted-average diluted shares',['WeightedAverageNumberOfDilutedSharesOutstanding']],
   ['Common shares outstanding (DEI)',['EntityCommonStockSharesOutstanding']],
   ['Latest cash and cash equivalents',['CashAndCashEquivalentsAtCarryingValue']],
   ['Latest current assets',['AssetsCurrent']],
   ['Latest current liabilities',['LiabilitiesCurrent']],
   ['Latest current long-term debt',['LongTermDebtCurrent']],
   ['Latest noncurrent long-term debt',['LongTermDebtNoncurrent']],
   ['Latest short-term borrowings',['ShortTermBorrowings']],
   // Bank- and lender-aware, independently dated balance-sheet observations.
   // Absence of standardized issuer-wide facts is an unknown, NOT zero.
   ['Latest total assets',['Assets']],
   ['Latest stockholders equity',['StockholdersEquity']],
   ['Latest customer deposits',['Deposits','DepositsAndOtherCustomerAccounts']],
   ['Latest loans receivable',['LoansAndLeasesReceivableNetReportedAmount','LoansAndLeasesReceivableNetOfDeferredIncome']],
   ['Latest loan-loss allowance',['AllowanceForLoanAndLeaseLosses','FinancingReceivableAllowanceForCreditLosses']],

  ].map(([name,tags])=>{const unit=name==='Diluted EPS'?'USD/shares':name==='Weighted-average diluted shares'||name==='Common shares outstanding (DEI)'?'shares':'USD';const result=name==='Revenue'?revenueSelection:name==='Common shares outstanding (DEI)'?instantOutstandingShares(facts.facts):name.startsWith('Latest ')?latestInstantFact(facts.facts,tags,unit):selectFact(facts.facts,tags,unit);const supportedTags=name==='Revenue'?REVENUE_TAGS:tags;return {name,unit,...result,sourceFactPresent:supportedTags.some(tag=>Boolean(facts.facts?.['us-gaap']?.[tag])),excludedBroaderFact:name==='Capital expenditures'&&broaderCapex?{...broaderCapex,tag:'PaymentsToAcquireProductiveAssets'}:undefined};});
  const factTaxonomies={usGaap:Boolean(facts.facts?.['us-gaap']),ifrsFull:Boolean(facts.facts?.['ifrs-full'])};
  json(res,200,{ticker,name:facts.entityName||match.title,cik,source,retrievedAt,sourceCacheStatus:factsResult.cacheStatus,classification,factTaxonomies,metrics});
 }catch(e){json(res,503,publicSecError(e,'SEC data temporarily unavailable'));}
 return true;
}
