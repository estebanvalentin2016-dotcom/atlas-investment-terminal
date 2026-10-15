const API='https://api.crossref.org/works';
const MAX_RESULTS=8;
export function normalizePublications(body,query='',today=new Date().toISOString().slice(0,10)){
 const items=body?.message?.items;
 if(!Array.isArray(items))throw new Error('Publication provider returned an unexpected response');
 return items.filter(x=>typeof x?.DOI==='string'&&Array.isArray(x.title)&&typeof x.title[0]==='string').map(x=>{
 const date=x.published?.['date-parts']?.[0]||x.created?.['date-parts']?.[0];
 const year=Number(date?.[0]),month=Number(date?.[1]||1),day=Number(date?.[2]||1);
 const published=Number.isInteger(year)&&year>1900?String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'):null;
 const doi=x.DOI;
 return {title:x.title[0].replace(/<[^>]*>/g,'').trim(),doi,url:'https://doi.org/'+encodeURIComponent(doi).replace(/%2F/gi,'/'),published,venue:String(x['container-title']?.[0]||''),type:String(x.type||'publication')};
 }).filter(x=>x.title.length>0&&(!x.published||x.published<=today)).filter(x=>{const words=query.toLowerCase().match(/[a-z0-9]+/g)||[];return words.every(w=>x.title.toLowerCase().includes(w))}).slice(0,MAX_RESULTS);
}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
export async function handleDiscoveryRequest(req,res){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname!=='/api/discovery/publications')return false;
 if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return true}
 const query=(url.searchParams.get('q')||'').trim();
 if(query.length<3||query.length>100){json(res,400,{error:'Enter a research query of 3 to 100 characters'});return true}
 try{
 const target=new URL(API);target.searchParams.set('query.title',query);target.searchParams.set('rows','100');target.searchParams.set('filter','until-pub-date:'+new Date().toISOString().slice(0,10));target.searchParams.set('sort','published');target.searchParams.set('order','desc');target.searchParams.set('select','DOI,title,published,created,container-title,type');
 const response=await fetch(target,{headers:{'Accept':'application/json','User-Agent':'ATLASResearchTerminal/0.5 (research prototype)'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('Publication index returned HTTP '+response.status);
 const data=normalizePublications(await response.json(),query);
 json(res,200,{provider:'Crossref',query,retrievedAt:new Date().toISOString(),items:data});
 }catch(e){json(res,502,{error:e instanceof Error?e.message:'Publication lookup unavailable'})}
 return true;
}
