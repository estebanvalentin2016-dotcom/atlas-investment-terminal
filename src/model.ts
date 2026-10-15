export type Company = { ticker: string; name: string; sector: string; price: number; marketCap: number; revenue: number; growth: number; margin: number; pe: number; debtToEquity: number; fcfMargin: number; description: string; points: number[] };
export type Inputs = { growth: number; margin: number; pe: number; years: number; dilution: number };
export type Scenario = { name: string; inputs: Inputs };
export const companies: Company[] = [
 {ticker:'ASTR',name:'Aster Cloud Systems',sector:'Cloud Infrastructure',price:84.60,marketCap:42.3,revenue:5.2,growth:32,margin:16,pe:43,debtToEquity:.22,fcfMargin:21,description:'Cloud infrastructure and developer platforms with recurring enterprise revenue.',points:[34,36,35,39,42,40,45,50,48,54,58,63,60,66,71,69,75,81,78,85]},
 {ticker:'NOVA',name:'Nova Security',sector:'Cybersecurity',price:122.40,marketCap:61.2,revenue:4.6,growth:29,margin:13,pe:61,debtToEquity:.12,fcfMargin:27,description:'Unified endpoint and network security with subscription-led growth.',points:[40,42,46,44,49,53,52,59,56,61,65,64,72,75,71,79,83,84,91,96]},
 {ticker:'VCTR',name:'Vector Semiconductors',sector:'Semiconductors',price:68.20,marketCap:34.1,revenue:7.1,growth:24,margin:23,pe:25,debtToEquity:.41,fcfMargin:18,description:'Specialized chips for high-throughput AI and industrial computing.',points:[60,57,63,68,65,61,72,73,67,77,82,74,79,83,86,84,92,88,94,99]},
 {ticker:'ORBT',name:'Orbit Data Networks',sector:'Data Infrastructure',price:47.50,marketCap:19.0,revenue:3.2,growth:19,margin:9,pe:42,debtToEquity:.35,fcfMargin:14,description:'Data networking hardware, software and monitoring for enterprise customers.',points:[58,55,56,59,61,60,62,57,64,68,66,69,71,70,74,72,79,77,82,86]},
 {ticker:'SOLR',name:'Solara Grid',sector:'Energy Technology',price:39.10,marketCap:15.6,revenue:4.0,growth:17,margin:12,pe:33,debtToEquity:.78,fcfMargin:8,description:'Grid optimization technologies for utilities and commercial operators.',points:[74,69,66,71,68,64,67,72,70,75,77,73,79,76,81,78,84,86,82,88]},
 {ticker:'AXON',name:'Axion Automation',sector:'Industrial Software',price:96.30,marketCap:38.5,revenue:4.4,growth:22,margin:19,pe:46,debtToEquity:.18,fcfMargin:24,description:'Factory analytics and automation software deployed across industrial facilities.',points:[39,41,46,43,51,48,55,57,54,60,63,68,65,72,76,73,80,84,82,90]},
 {ticker:'LYRA',name:'Lyra Health Tech',sector:'Healthcare Technology',price:54.80,marketCap:21.9,revenue:2.9,growth:27,margin:7,pe:66,debtToEquity:.09,fcfMargin:11,description:'Clinical workflow software used by healthcare systems and providers.',points:[55,52,58,60,57,62,65,61,66,70,68,74,72,76,74,79,82,78,85,89]},
 {ticker:'KITE',name:'Kite Payments',sector:'Financial Technology',price:75.20,marketCap:30.1,revenue:3.7,growth:21,margin:21,pe:39,debtToEquity:.25,fcfMargin:26,description:'Payments infrastructure serving digital merchants and platforms.',points:[45,48,44,50,53,55,54,57,60,56,64,68,65,69,73,75,71,79,82,86]}
];
export const fmtMoney = (n:number, decimals=1) => `$${n.toFixed(decimals)}B`;
export const fmtPct = (n:number) => `${n>=0?'+':''}${n.toFixed(1)}%`;
export function calculateValuation(company: Company, inputs: Inputs) {
 const revenue = company.revenue*Math.pow(1+inputs.growth/100, inputs.years);
 const earnings = revenue*inputs.margin/100;
 const futureCap = earnings*inputs.pe;
 const shareGrowth = Math.pow(1+inputs.dilution/100,inputs.years);
 const impliedPrice = company.price*(futureCap/company.marketCap)/shareGrowth;
 const totalReturn = (impliedPrice/company.price-1)*100;
 const cagr = (Math.pow(impliedPrice/company.price,1/inputs.years)-1)*100;
 return {revenue,earnings,futureCap,impliedPrice,totalReturn,cagr};
}
export function opportunityScore(c:Company) {
 const growth = Math.min(100, c.growth/40*100);
 const quality = Math.min(100, Math.max(0,c.fcfMargin*3 + c.margin*1.15 - c.debtToEquity*35));
 const valuation = Math.min(100,Math.max(0,110-c.pe*1.45));
 return {growth:Math.round(growth),quality:Math.round(quality),valuation:Math.round(valuation),total:Math.round(growth*.4+quality*.35+valuation*.25)};
}
export const startingInputs = (c:Company): Inputs => ({growth:c.growth,margin:Math.min(35,c.margin+5),pe:Math.min(45,c.pe),years:5,dilution:1});
export function makeScenarios(base:Inputs):Scenario[] {return [
 {name:'Bear',inputs:{...base,growth:Math.max(0,base.growth-12),margin:Math.max(1,base.margin-7),pe:Math.max(5,base.pe-12),dilution:base.dilution+2}},
 {name:'Base',inputs:base},
 {name:'Bull',inputs:{...base,growth:base.growth+8,margin:Math.min(50,base.margin+6),pe:base.pe+10,dilution:Math.max(0,base.dilution-1)}}
]}
