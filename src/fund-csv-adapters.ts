// Browser-local holdings ingestion for official fund-provider CSV exports.
// These are UNVERIFIED user-supplied files; not live provider API adapters,
// and cannot create an independent-active-manager signal.
export type FundProvider='Vanguard'|'iShares'|'SPDR';
export type ImportedFundPosition={ticker:string;issuer:string;cusip:string|null;shares:number;weightPct:number|null;marketValue:number|null};
export type ImportedFundSnapshot={provider:FundProvider;fundId:string;asOfDate:string|null;publishedDate:null;sourceUrl:string;sourceVerification:'user_supplied_unverified';positions:ImportedFundPosition[];excluded:number;header:string[];coverage:string};
function rows(csv:string):string[][]{
 const data:string[][]=[];let fields:string[]=[],field='',quoted=false;
 for(let i=0;i<csv.length;i++){
  const char=csv[i];
  if(quoted){
   if(char==='"'&&csv[i+1]==='"'){field+='"';i++}
   else if(char==='"')quoted=false;
   else field+=char;
  }else if(char==='"')quoted=true;
  else if(char===','){fields.push(field.trim());field=''}
  else if(char==='\n'||char==='\r'){
   if(char==='\r'&&csv[i+1]==='\n')i++;
   fields.push(field.trim());field='';
   if(fields.some(Boolean))data.push(fields);
   fields=[];
  }else field+=char;
 }
 if(quoted)throw Error('CSV has an unterminated quoted field');
 fields.push(field.trim());if(fields.some(Boolean))data.push(fields);
 return data;
}
const asDate=(input:string)=>{const d=new Date(input.trim());return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):null};
const label=(input:string)=>input.toLowerCase().replace(/[^a-z0-9]/g,'');
const number=(value:string)=>{const t=value.replace(/[$,%\s,]/g,'').replace(/^\((.*)\)$/,'-$1');return t&&Number.isFinite(Number(t))?Number(t):null};
const originAllowed=(provider:FundProvider,source:string)=>{
 try{
  const u=new URL(source);
  if(u.protocol!=='https:')return false;
  const host=u.hostname.toLowerCase();
  const roots:Record<FundProvider,string[]>={Vanguard:['vanguard.com'],iShares:['ishares.com','blackrock.com'],SPDR:['ssga.com','spdrs.com']};
  return roots[provider].some(x=>host===x||host.endsWith('.'+x));
 }catch{return false}
};
export function parseProviderFundCSV(text:string,provider:FundProvider,fundId:string,sourceUrl:string):ImportedFundSnapshot{
 if(text.length>9000000)throw Error('Fund CSV exceeds 9 MB size cap');
 if(!/^[A-Z0-9.-]{2,15}$/i.test(fundId))throw Error('Enter a valid fund ticker / identifier');
 if(!originAllowed(provider,sourceUrl))throw Error('Source URL must be an official HTTPS domain for this fund provider');
 let data=rows(text.replace(/^\uFEFF/,''));
 if(data[0]?.[0]?.toLowerCase().startsWith('sep='))data=data.slice(1);
 const candidates=[
  ['cusip','quantity','weight'],['cusip','sharesheld','weight'],
  ['cusip','shares','weight'],['isin','quantity','weight'],
  ['cusip','quantity'],['cusip','sharesheld'],['cusip','shares'],['isin','quantity'],['isin','shares']
 ];
 const headerIndex=data.findIndex(line=>{
  const names=line.map(label);
  return candidates.some(pattern=>pattern.every(key=>names.some(name=>name===key||name.startsWith(key))))
 });
 if(headerIndex<0)throw Error('No recognized fund CSV holdings header with CUSIP/ISIN and share quantity. XLSX files must be exported to CSV first.');
 const header=data[headerIndex].map(label);
 const column=(options:string[])=>header.findIndex(x=>options.some(name=>x===name||x.startsWith(name)));
 const issuer=column(['name','securityname','holdingname','issuer','company','securitydescription']);
 const tick=column(['ticker','symbol','holdingticker']);
 const id=column(['cusip','isin']);
 const shares=column(['quantity','sharesheld','shares','sharequantity','units']);
 const weight=column(['weight','portfolioweight','percentofnetassets']);
 const value=column(['marketvalue','valueusd','value']);
 if(issuer<0||shares<0||id<0)throw Error('CSV needs issuer name, share quantity and CUSIP or ISIN');
 let asOfDate:string|null=null;
 for(const line of data.slice(0,headerIndex)){
  const descriptor=label(line[0]||'');
  if(descriptor.includes('holdingsasof')||descriptor==='asofdate'||descriptor==='portfolioasofdate'||descriptor==='asof'){
   asOfDate=asDate(line[1]||'');if(asOfDate)break;
  }
 }
 let excluded=0;const positions:ImportedFundPosition[]=[];
 for(const cells of data.slice(headerIndex+1)){
  if(cells.length<Math.min(header.length,3)||!cells[issuer]){excluded++;continue}
  const amount=number(cells[shares]||''),rawId=(cells[id]||'').replaceAll(' ','').toUpperCase();
  const cusip=/^[A-Z0-9]{9}$/.test(rawId)?rawId:/^US[A-Z0-9]{9}\d$/.test(rawId)?rawId.slice(2,11):null;
  if(amount===null||amount<0||!cusip){excluded++;continue}
  positions.push({ticker:tick>=0?(cells[tick]||'').trim():'',issuer:cells[issuer].trim(),cusip,shares:amount,weightPct:weight>=0?number(cells[weight]||''):null,marketValue:value>=0?number(cells[value]||''):null});
 }
 if(!positions.length)throw Error('No valid CUSIP-linked fund share holdings in this file; import withheld');
 return {provider,fundId:fundId.toUpperCase(),asOfDate,publishedDate:null,sourceUrl,sourceVerification:'user_supplied_unverified',positions,excluded,header,coverage:'Parsed provided CSV rows, not a verified complete fund portfolio. Original publication date and investment mandate are unknown. Import is excluded from active-institution consensus.'};
}
