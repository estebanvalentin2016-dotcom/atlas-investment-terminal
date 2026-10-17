const SEC='https://data.sec.gov';
function output(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
export function recentCatalysts(data,cik,limit=12){
 const r=data?.filings?.recent;
 if(!r||!Array.isArray(r.form)||!Array.isArray(r.accessionNumber)||!Array.isArray(r.filingDate))throw new Error('SEC filing data unavailable');
 const rows=[];for(let i=0;i<r.form.length&&rows.length<limit;i++){
  if(!['8-K','8-K/A'].includes(r.form[i]))continue;
  const accession=r.accessionNumber[i],document=r.primaryDocument?.[i],date=r.filingDate[i];
  if(!/^\d{10}-\d{2}-\d{6}$/.test(accession)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!document||document.includes('/')||document.includes('..'))continue;
  const items=String(r.items?.[i]||'');
  // Preserve timezone-aware SEC acceptance time only; never infer a time from filingDate.
  const candidate=r.acceptanceDateTime?.[i];
  const acceptedAt=typeof candidate==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(candidate)&&/(Z|[+-]\d{2}:?\d{2})$/.test(candidate)&&Number.isFinite(Date.parse(candidate))?candidate:null;
  const classifications=[];
  if(/\b2\.02\b/.test(items))classifications.push('Results of operations');
  if(/\b1\.01\b/.test(items))classifications.push('Material agreement');
  if(/\b2\.03\b/.test(items))classifications.push('Financial obligation');
  if(/\b3\.02\b/.test(items))classifications.push('Unregistered securities');
  if(/\b5\.02\b/.test(items))classifications.push('Leadership change');
  const filingUrl='https://www.sec.gov/Archives/edgar/data/'+Number(cik)+'/'+accession.replaceAll('-','')+'/'+encodeURIComponent(document);
  rows.push({form:r.form[i],date,acceptedAt,items,labels:classifications.length?classifications:['Other 8-K event'],url:filingUrl,accession});
 }
 return rows;
}
export async function handleCatalystRequest(req,res){
 const u=new URL(req.url,'http://localhost');if(u.pathname!=='/api/catalyst/sec')return false;
 if(req.method!=='GET'){output(res,405,{error:'Method not allowed'});return true}
 const ticker=(u.searchParams.get('ticker')||'').trim().toUpperCase();
 if(!/^[A-Z0-9.-]{1,12}$/.test(ticker)){output(res,400,{error:'Invalid ticker'});return true}
 try{
 const agent=process.env.SEC_USER_AGENT;if(!agent||!agent.includes('@'))throw new Error('SEC_USER_AGENT is not configured');
 const fetchJson=async url=>{const x=await fetch(url,{headers:{'User-Agent':agent,'Accept':'application/json'},signal:AbortSignal.timeout(15000)});if(!x.ok)throw new Error('SEC HTTP '+x.status);return x.json()};
 const index=await fetchJson('https://www.sec.gov/files/company_tickers.json');
 const match=Object.values(index).find(x=>x.ticker?.toUpperCase()===ticker);
 if(!match){output(res,404,{error:'Ticker not in SEC index'});return true}
 const cik=String(match.cik_str).padStart(10,'0');
 const raw=await fetchJson(SEC+'/submissions/CIK'+cik+'.json');
 output(res,200,{ticker,cik,name:raw.name||match.title,retrievedAt:new Date().toISOString(),filings:recentCatalysts(raw,cik)});
 }catch(e){output(res,502,{error:e instanceof Error?e.message:'SEC lookup unavailable'})}
 return true;
}
