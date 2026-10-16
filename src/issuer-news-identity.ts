// Issuer identity gate for *news discovery candidates*, not a news-catalyst
// corroboration verdict. A short stock ticker is often an ordinary acronym
// or another firm's abbreviation (AA -> American Airlines vs Alcoa).
const legal=new Set(['inc','incorporated','corp','corporation','co','company','companies','ltd','limited','plc','llc','lp','llp','sa','ag','nv','holdings','holding','group','the']);
const words=(text:string)=>text.toLowerCase().replace(/&/g,' and ').match(/[a-z0-9]+/g)||[];
export function issuerSearchName(name:string):string|null{
 if(typeof name!=='string'||name.length>150)return null;
 const original=words(name);
 while(original.length&&legal.has(original[0]!))original.shift();
 while(original.length&&legal.has(original.at(-1)!))original.pop();
 const meaningful=original.filter(x=>!['of','and','a','an'].includes(x));
 if(!meaningful.length||meaningful[0].length<4)return null;
 // Require both distinctive terms when issuer names contain more than one:
 // 'American Express' and 'American Airlines' must not be interchangeable.
 return meaningful.slice(0,2).join(' ');
}
export function headlineReferencesIssuer(headline:string,issuerName:string):boolean{
 const phrase=issuerSearchName(issuerName);
 if(!phrase||typeof headline!=='string')return false;
 const tokenized=words(headline).filter(x=>!['of','and','a','an'].includes(x)).join(' ');
 const tokens=phrase.split(' ');
 // A single word must match as a whole token, not a prefix within another name.
 // Multiword identities must occur in sequence; unlabeled ticker matches are
 // explicitly not accepted as issuer identity evidence.
 return (' '+tokenized+' ').includes(' '+tokens.join(' ')+' ');
}
