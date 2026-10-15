const SEC_ROOT='https://data.sec.gov';
const TICKERS='https://www.sec.gov/files/company_tickers.json';
const ttl=30*60*1000;
const cache=new Map();
function cached(key,loader){const item=cache.get(key);if(item&&item.until>Date.now())return Promise.resolve(item.data);return loader().then(data=>{cache.set(key,{data,until:Date.now()+ttl});return data});}
async function secJson(url){
 const identity=process.env.SEC_USER_AGENT;
 if(!identity||!identity.includes('@'))throw new Error('SEC_USER_AGENT is not configured. Set a contact name and real email as explained in README.');
 const response=await fetch(url,{headers:{'User-Agent':identity,'Accept':'application/json'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('SEC responded with HTTP '+response.status+'. Try again later.');
 return response.json();
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
export function selectFact(facts,tags,unit='USD'){
 for(const tag of tags){const annual=annualValues(facts?.['us-gaap']?.[tag],unit);if(annual.length)return {tag,values:annual};}
 return {tag:null,values:[]};
}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
export async function handleSecRequest(req,res){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname!=='/api/sec/company')return false;
 if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return true;}
 const ticker=(url.searchParams.get('ticker')||'').toUpperCase().trim();
 if(!/^[A-Z0-9.\-]{1,12}$/.test(ticker)){json(res,400,{error:'Enter a valid ticker symbol'});return true;}
 try{
  const index=await cached('tickers',()=>secJson(TICKERS));
  const match=Object.values(index).find(c=>c.ticker?.toUpperCase()===ticker);
  if(!match){json(res,404,{error:'Ticker not found in SEC company ticker list'});return true;}
  const cik=String(match.cik_str).padStart(10,'0');
  const source=SEC_ROOT+'/api/xbrl/companyfacts/CIK'+cik+'.json';
  const facts=await cached(cik,()=>secJson(source));
  const metrics=[
   ['Revenue',['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet']],
   ['Net income',['NetIncomeLoss']],
   ['Operating cash flow',['NetCashProvidedByUsedInOperatingActivities']],
   ['Total assets',['Assets']],
  ].map(([name,tags])=>{const result=selectFact(facts.facts,tags);return {name,unit:'USD',...result};});
  json(res,200,{ticker,name:facts.entityName||match.title,cik,source,retrievedAt:new Date().toISOString(),metrics});
 }catch(e){json(res,503,{error:e instanceof Error?e.message:'SEC data temporarily unavailable'});}
 return true;
}
