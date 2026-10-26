// Filing-backed values already exercised by financial-coverage.test.ts.
// Test-only fixture: not a production source-selection rule.
export const filings=[
 {ticker:'NVDA',cik:1045810,name:'NVIDIA CORP',year:2026,start:'2025-01-27',end:'2026-01-25',priorStart:'2024-01-29',priorEnd:'2025-01-26',filed:'2026-02-25',accession:'0001045810-26-000021',revenueTag:'Revenues',revenue:215938000000,priorRevenue:130497000000,operating:102718000000,net:120067000000,capex:null,productiveAssets:6042000000},
 {ticker:'AMD',cik:2488,name:'ADVANCED MICRO DEVICES INC',year:2025,start:'2024-12-29',end:'2025-12-27',priorStart:'2023-12-31',priorEnd:'2024-12-28',filed:'2026-02-04',accession:'0000002488-26-000018',revenueTag:'RevenueFromContractWithCustomerExcludingAssessedTax',revenue:34639000000,priorRevenue:25785000000,operating:7709000000,net:4335000000,capex:974000000,productiveAssets:null,continuingOperating:6493000000,discontinuedOperating:1216000000,continuingNet:4269000000,discontinuedNet:66000000,discontinuedCapexInFiling:38000000},
 {ticker:'CRWD',cik:1535527,name:'CrowdStrike Holdings, Inc.',year:2026,start:'2025-02-01',end:'2026-01-31',priorStart:'2024-02-01',priorEnd:'2025-01-31',filed:'2026-03-05',accession:'0001535527-26-000010',revenueTag:'RevenueFromContractWithCustomerIncludingAssessedTax',revenue:4812005000,priorRevenue:3953624000,operating:1612349000,net:-162502000,capex:302108000,productiveAssets:null,consolidatedNet:-161165000,noncontrollingNet:1337000,capitalizedSoftware:68751000}
] as const;

const annual=(row:typeof filings[number],value:number,end:string=row.end,start:string=row.start)=>({form:'10-K',fp:'FY',start,end,filed:row.filed as string,accn:row.accession as string,val:value});
export const fact=(...values:ReturnType<typeof annual>[])=>({units:{USD:values}});
export function rawFacts(row:typeof filings[number]){
 const gaap:Record<string,unknown>={
  [row.revenueTag]:fact(annual(row,row.revenue),annual(row,row.priorRevenue,row.priorEnd,row.priorStart)),
  NetCashProvidedByUsedInOperatingActivities:fact(annual(row,row.operating)),
  NetIncomeLoss:fact(annual(row,row.net))
 };
 if(row.ticker==='AMD'){
  gaap.NetCashProvidedByUsedInOperatingActivitiesContinuingOperations=fact(annual(row,row.continuingOperating));
  gaap.CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations=fact(annual(row,row.discontinuedOperating));
  gaap.IncomeLossFromContinuingOperations=fact(annual(row,row.continuingNet));
  gaap.IncomeLossFromDiscontinuedOperationsNetOfTaxAttributableToReportingEntity=fact(annual(row,row.discontinuedNet));
 }
 if(row.ticker==='CRWD'){
  gaap.ProfitLoss=fact(annual(row,row.consolidatedNet));
  gaap.NetIncomeLossAttributableToNoncontrollingInterest=fact(annual(row,row.noncontrollingNet));
  gaap.PaymentsToDevelopSoftware=fact(annual(row,row.capitalizedSoftware));
  gaap.PaymentsToAcquireIntangibleAssets=fact(annual(row,0));
 }
 if(row.capex!==null)gaap.PaymentsToAcquirePropertyPlantAndEquipment=fact(annual(row,row.capex));
 else{
  gaap.PaymentsToAcquirePropertyPlantAndEquipment=fact({form:'10-K',fp:'FY',start:'2011-01-31',end:'2012-01-29',filed:'2012-03-13',accn:'0001045810-12-000007',val:138735000});
  gaap.PaymentsToAcquireProductiveAssets=fact(annual(row,row.productiveAssets!));
 }
 return {entityName:row.name,facts:{'us-gaap':gaap}};
}
