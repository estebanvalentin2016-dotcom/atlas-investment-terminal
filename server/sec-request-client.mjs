const SEC_HOSTS=new Set(['www.sec.gov','data.sec.gov']);
export const SEC_REQUEST_INTERVAL_MS=150;
export const SEC_DEFAULT_MAX_ATTEMPTS=3;
const MAX_RETRY_DELAY_MS=30000;

export class SecRequestError extends Error{
 constructor(category,message,{status=null,retryable=false}={}){
  super(message);this.name='SecRequestError';this.category=category;this.status=status;this.retryable=retryable;
 }
}

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const identity=()=>process.env.SEC_USER_AGENT;
const safeUrl=value=>{
 let parsed;
 try{parsed=new URL(String(value))}catch{throw new SecRequestError('invalid_request','Invalid SEC source URL')}
 if(parsed.protocol!=='https:'||!SEC_HOSTS.has(parsed.hostname)||parsed.username||parsed.password)throw new SecRequestError('invalid_request','Invalid SEC source URL');
 return parsed.toString();
};
const requireIdentity=provider=>{
 const value=provider();
 if(!value||!value.includes('@'))throw new SecRequestError('configuration','SEC_USER_AGENT is not configured. Set a contact name and real email as explained in README.');
 return value;
};
const errorCodes=error=>{
 const codes=[];let item=error;
 for(let depth=0;item&&depth<4;depth++,item=item.cause){if(typeof item.code==='string')codes.push(item.code)}
 return codes;
};
const networkFailure=error=>{
 const codes=errorCodes(error);
 if(codes.some(code=>['EACCES','EPERM'].includes(code)))return new SecRequestError('network_access_denied','SEC network access is unavailable in this server environment.');
 if(error?.name==='TimeoutError'||error?.name==='AbortError'||codes.some(code=>['ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT'].includes(code)))return new SecRequestError('timeout','SEC request timed out.',{retryable:true});
 return new SecRequestError('network_error','SEC network request failed.',{retryable:true});
};
const retryAfterMs=(value,now)=>{
 if(!value)return null;
 if(/^\d+(?:\.\d+)?$/.test(value.trim()))return Math.max(0,Math.ceil(Number(value)*1000));
 const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,date-now()):null;
};
const httpFailure=response=>{
 if(response.status===429)return new SecRequestError('upstream_throttled','SEC request was throttled. Try again later.',{status:429,retryable:true});
 if([500,502,503,504].includes(response.status))return new SecRequestError('upstream_server_error','SEC service returned a temporary server error.',{status:response.status,retryable:true});
 if([401,403].includes(response.status))return new SecRequestError('upstream_access_denied','SEC denied the automated request. Verify SEC identification and access policy.',{status:response.status});
 return new SecRequestError('upstream_http_error','SEC returned HTTP '+response.status+'.',{status:response.status});
};

class SecStartScheduler{
 constructor({now,sleep,minIntervalMs}){this.now=now;this.sleep=sleep;this.minIntervalMs=minIntervalMs;this.nextStartAt=0;this.tail=Promise.resolve()}
 async run(start){
  const prior=this.tail;let release;
  this.tail=new Promise(resolve=>{release=resolve});
  await prior;
  try{
   const delay=Math.max(0,this.nextStartAt-this.now());
   if(delay>0)await this.sleep(delay);
   this.nextStartAt=Math.max(this.nextStartAt,this.now())+this.minIntervalMs;
   const result=start();
   release();
   return result;
  }catch(error){release();throw error}
 }
}

export function createSecRequestClient({
 fetchImpl=(...args)=>globalThis.fetch(...args),
 now=()=>Date.now(),sleep=wait,minIntervalMs=SEC_REQUEST_INTERVAL_MS,
 identityProvider=identity,defaultMaxAttempts=SEC_DEFAULT_MAX_ATTEMPTS,maxCacheEntries=240
}={}){
 const scheduler=new SecStartScheduler({now,sleep,minIntervalMs});
 const responseInflight=new Map(),jsonInflight=new Map(),jsonCache=new Map();
 const requestKey=(url,options)=>[url,options.accept||'application/json',options.redirect||'error',options.timeoutMs||15000,(options.allowedStatuses||[]).join(',')].join('|');

 async function execute(url,options){
  const userAgent=requireIdentity(identityProvider);
  const attempts=Math.max(1,Math.min(3,options.maxAttempts??defaultMaxAttempts));
  const allowed=new Set(options.allowedStatuses||[]);
  for(let attempt=1;attempt<=attempts;attempt++){
   let response;
   try{
    response=await scheduler.run(()=>fetchImpl(url,{headers:{'User-Agent':userAgent,'Accept':options.accept||'application/json'},redirect:options.redirect||'error',signal:AbortSignal.timeout(options.timeoutMs||15000)}));
   }catch(error){
    const failure=error instanceof SecRequestError?error:networkFailure(error);
    if(!failure.retryable||attempt===attempts)throw failure;
    await sleep(Math.min(MAX_RETRY_DELAY_MS,500*2**(attempt-1)));
    continue;
   }
   if(response.ok||allowed.has(response.status))return response;
   const failure=httpFailure(response);
   try{await response.body?.cancel()}catch{}
   if(!failure.retryable||attempt===attempts)throw failure;
   const retryAfter=retryAfterMs(response.headers.get('retry-after'),now());
   if(retryAfter!==null&&retryAfter>MAX_RETRY_DELAY_MS)throw failure;
   await sleep(retryAfter??Math.min(MAX_RETRY_DELAY_MS,500*2**(attempt-1)));
  }
  throw new SecRequestError('network_error','SEC network request failed.');
 }

 async function request(input,options={}){
  const url=safeUrl(input),key=requestKey(url,options);
  let entry=responseInflight.get(key);
  if(!entry){
   entry={waiters:0,promise:execute(url,options)};
   responseInflight.set(key,entry);
  }
  entry.waiters++;
  try{
   const response=await entry.promise;
   return response.clone();
  }finally{
   entry.waiters--;
   if(entry.waiters===0&&responseInflight.get(key)===entry){
    responseInflight.delete(key);
    void entry.promise.then(response=>response.body?.cancel()).catch(()=>{});
   }
  }
 }

 async function json(input,options={}){
  const url=safeUrl(input),accept=options.accept||'application/json',key=url+'|'+accept;
  const cached=jsonCache.get(key);
  if(cached&&cached.expiresAt>now())return {data:cached.data,retrievedAt:cached.retrievedAt,cacheStatus:'cached',expiresAt:new Date(cached.expiresAt).toISOString()};
  if(cached)jsonCache.delete(key);
  const current=jsonInflight.get(key);
  if(current)return current;
  const task=(async()=>{
   const response=await request(url,{...options,accept});
   let data;
   try{data=await response.json()}
   catch{throw new SecRequestError('malformed_response','SEC returned an unreadable JSON response.')}
   const fetchedAt=now(),retrievedAt=new Date(fetchedAt).toISOString(),ttlMs=Math.max(0,options.cacheTtlMs||0),expiresAt=fetchedAt+ttlMs;
   if(ttlMs>0){
    if(jsonCache.size>=maxCacheEntries)jsonCache.delete(jsonCache.keys().next().value);
    jsonCache.set(key,{data,retrievedAt,expiresAt});
   }
   return {data,retrievedAt,cacheStatus:'retrieved',expiresAt:new Date(expiresAt).toISOString()};
  })();
  jsonInflight.set(key,task);
  try{return await task}finally{if(jsonInflight.get(key)===task)jsonInflight.delete(key)}
 }

 return {request,json,clear(){jsonCache.clear();jsonInflight.clear();responseInflight.clear()}};
}

const shared=createSecRequestClient();
export const fetchSec=(url,options)=>shared.request(url,options);
export const fetchSecJson=(url,options)=>shared.json(url,options);
export const requireSecIdentity=()=>requireIdentity(identity);
export const malformedSecResponse=()=>new SecRequestError('malformed_response','SEC returned an unreadable response.');
export function publicSecError(error,fallback='SEC source unavailable'){
 if(error instanceof SecRequestError)return {error:error.message,errorCategory:error.category};
 return {error:fallback,errorCategory:'unexpected_error'};
}
