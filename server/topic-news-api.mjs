// Discovery Feed: live public keyword coverage, not news sentiment or issuer first-release timing.
import {parseAnnouncementFeed} from './announcement-api.mjs';
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
export async function handleTopicNewsRequest(req,res){
 const u=new URL(req.url,'http://localhost');
 if(u.pathname!=='/api/discovery/topic-news')return false;
 if(req.method!=='GET'){send(res,405,{error:'Method not allowed'});return true}
 const query=(u.searchParams.get('q')||'').trim();
 if(query.length<3||query.length>100||/[<>\n\r]/.test(query)){send(res,400,{error:'Enter a valid 3–100 character research keyword'});return true}
 try{
  const target=new URL('https://news.google.com/rss/search');
  target.searchParams.set('q',query);
  target.searchParams.set('hl','en-US');target.searchParams.set('gl','US');target.searchParams.set('ceid','US:en');
  const response=await fetch(target,{headers:{'User-Agent':'ATLAS-research/0.13 (public news discovery)','Accept':'application/rss+xml, application/xml, text/xml'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Google News RSS HTTP '+response.status);
  const xml=await response.text();
  const day=new Date().toISOString().slice(0,10);
  const items=parseAnnouncementFeed(xml,day);
  send(res,200,{query,provider:'Google News RSS',retrievedAt:new Date().toISOString(),items,coverage:'Up to 10 recently indexed Google News RSS records; not complete news coverage',originalPublicationVerified:false,note:'Google News feed times can reflect aggregation. Repeated publication clocks may not represent exact publisher times.'});
 }catch(e){send(res,502,{error:e instanceof Error?e.message:'News topic discovery unavailable'})}
 return true;
}
