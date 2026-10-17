// Public news discovery only. RSS publication dates are NOT original issuer release timestamps.
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
const decode=s=>String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const tag=(xml,name)=>{const m=xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'));return m?decode(m[1].trim()):''};
export function parseAnnouncementFeed(xml,day){
 if(typeof xml!=='string'||xml.length>2e6)throw Error('Invalid news feed');
 const items=[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,25).map(m=>{
  const title=tag(m[1],'title').replace(/<[^>]*>/g,'').trim();
  const link=tag(m[1],'link').trim();
  const pub=tag(m[1],'pubDate');
  const source=tag(m[1],'source').replace(/<[^>]*>/g,'').trim();
  const date=Date.parse(pub);
  let valid=false;try{const url=new URL(link);valid=url.protocol==='https:'&&url.hostname.endsWith('google.com')}catch{}
  return {title,link:valid?link:null,source,feedPublishedAt:Number.isFinite(date)?new Date(date).toISOString():null};
 }).filter(x=>x.title&&x.link);
 return items.filter(x=>{if(!x.feedPublishedAt)return true;return Math.abs(Date.parse(x.feedPublishedAt)-Date.parse(day+'T12:00:00Z'))<=4*86400000}).slice(0,10);
}
export async function handleAnnouncementRequest(req,res){
 const u=new URL(req.url,'http://localhost');
 if(u.pathname!=='/api/catalyst/announcements')return false;
 if(req.method!=='GET'){send(res,405,{error:'Method not allowed'});return true}
 const ticker=(u.searchParams.get('ticker')||'').trim().toUpperCase();
 const day=u.searchParams.get('date')||'';
 if(!/^[A-Z0-9.-]{1,12}$/.test(ticker)||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T12:00:00Z'))||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day){send(res,400,{error:'Invalid ticker or date'});return true}
 try{
  const start=new Date(Date.parse(day+'T00:00:00Z')-2*86400000).toISOString().slice(0,10);
  const end=new Date(Date.parse(day+'T00:00:00Z')+4*86400000).toISOString().slice(0,10);
  const query='"'+ticker+'" (earnings OR guidance OR results OR investor OR announcement) after:'+start+' before:'+end;
  const url=new URL('https://news.google.com/rss/search');url.searchParams.set('q',query);url.searchParams.set('hl','en-US');url.searchParams.set('gl','US');url.searchParams.set('ceid','US:en');
  const r=await fetch(url,{headers:{'User-Agent':'ATLAS-research/0.9 (historical public news discovery)','Accept':'application/rss+xml, application/xml, text/xml'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Public news feed HTTP '+r.status);
  const xml=await r.text();
  const candidates=parseAnnouncementFeed(xml,day);
  send(res,200,{ticker,date:day,provider:'Google News RSS',retrievedAt:new Date().toISOString(),candidates,verifiedOriginalPublicationTimes:false,note:'Candidate news links only. Feed timestamps may represent aggregation rather than original issuer publication; no automatic timestamp eligibility is inferred.'});
 }catch(e){send(res,502,{error:e instanceof Error?e.message:'News discovery unavailable'})}
 return true;
}
