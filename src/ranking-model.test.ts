import {describe,expect,it} from 'vitest';
import {toneForReportedMetric,toneForReturn} from './filing-metric-tone';
import {defaultRankWeights,deriveRankingMetrics,rankCompanies,scoreCompany,assessEmergingFcfStrength,type SecCompany} from './ranking-model';
const annual=(year:number,value:number)=>({year,start:year+'-01-01',end:year+'-12-31',filed:(year+1)+'-02-15',unit:'USD',form:'10-K',accession:'0000000000-'+String(year%100).padStart(2,'0')+'-000010',value,reviewIssues:[] as string[]});
const company=(ticker:string,includeCapex=true):SecCompany=>({ticker,name:ticker+' Inc',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0123456789.json',retrievedAt:'2026-10-15T12:00:00Z',metrics:[
 {name:'Revenue',tag:'Revenues',unit:'USD',reportingScope:'entity_wide',values:[annual(2025,150),annual(2024,100)]},
 {name:'Net income',tag:'NetIncomeLoss',unit:'USD',reportingScope:'parent_attributable',values:[annual(2025,30)]},
 {name:'Operating cash flow',tag:'NetCashProvidedByUsedInOperatingActivities',unit:'USD',reportingScope:'total_operations',values:[annual(2025,38)]},
 {name:'Capital expenditures',tag:'PaymentsToAcquirePropertyPlantAndEquipment',unit:'USD',reportingScope:'unallocated_cash_purchases',values:includeCapex?[annual(2025,8)]:[]}
]});
const withProvenance=<T extends SecCompany>(sample:T):T=>{for(const metric of sample.metrics){metric.unit='USD';if(metric.name==='Revenue'){metric.tag='Revenues';metric.reportingScope='entity_wide'}else if(metric.name==='Operating cash flow'){metric.tag='NetCashProvidedByUsedInOperatingActivities';metric.reportingScope='total_operations'}else if(metric.name==='Capital expenditures'){metric.tag='PaymentsToAcquirePropertyPlantAndEquipment';metric.reportingScope='unallocated_cash_purchases'}else if(metric.name==='Net income'){metric.tag='NetIncomeLoss';metric.reportingScope='parent_attributable'}}return sample};
describe('Semantically colored report figures',()=>{
 it('shows true EPS/revenue increases as green +percent',()=>{
  expect(toneForReportedMetric('Reported EPS growth','25% increase in GAAP diluted EPS')).toEqual({tone:'positive',headline:'+25%',detail:'25% increase in GAAP diluted EPS'});
  expect(toneForReportedMetric('Reported revenue growth','19% increase in revenue').tone).toBe('positive');
 });
 it('shows declines as red and keeps ambiguous totals neutral',()=>{
  expect(toneForReportedMetric('Reported revenue growth','13% decrease in revenue')).toMatchObject({tone:'negative',headline:'−13%'});
  expect(toneForReportedMetric('Reported assets under management','$15.5 trillion in AUM').tone).toBe('neutral');
  expect(toneForReportedMetric('Reported cost growth','25% increase in operating costs').tone).toBe('neutral');
 });
 it('colors measured returns by sign without interpreting investment quality',()=>{
  expect(toneForReturn(1.75)).toBe('positive');
  expect(toneForReturn(-1.08)).toBe('negative');
  expect(toneForReturn(null)).toBe('neutral');
 });
});
describe('SEC annual fundamental ranking model',()=>{
 it('calculates cash flow AFTER actual capex with fiscal-year matching',()=>{
  const r=deriveRankingMetrics(company('TEST'));
  expect(r.year).toBe(2025);
  expect(r.fcf).toBe(30);
  expect(r.growth).toBe(50);
  expect(r.fcfMargin).toBe(20);
  expect(r.profitMargin).toBe(20);
 });
 it('never invents FCF when capex is absent',()=>{
  const r=deriveRankingMetrics(company('NOFCF',false));
  expect(r.fcf).toBeNull();
  expect(r.fcfMargin).toBeNull();
 });
 it('leaves missing P/E visibly missing and unable to earn valuation points',()=>{
  const a=scoreCompany(company('A'),defaultRankWeights);
  const b=scoreCompany(company('A'),defaultRankWeights,12);
  expect(a.metrics.pe).toBeNull();
  expect(a.missing).toContain('Automatic FY P/E');
  expect(a.coverage).toBe(85);
  expect(b.coverage).toBe(100);
  expect(b.score).toBeGreaterThan(a.score!);
 });
 it('refuses to rank a single-factor company regardless of high factor value',()=>{
  const data=company('ONE',false);
  data.metrics[1].values=[];
  const r=scoreCompany(data,defaultRankWeights);
  expect(r.score).toBeNull();
 });
 it('allows changing the ranking weights without treating missing factors as perfect',()=>{
  const sample=company('REAL');
  const a=scoreCompany(sample,{growth:0,fcf:100,profit:0,pe:0});
  const b=scoreCompany(sample,{growth:50,fcf:50,profit:0,pe:0});
  expect(a.score).toBeNull(); // need at least two independent verified SEC measures
  expect(b.score).not.toBeNull();
 });
 it('sorts only actual computed shortlist companies, not hidden hardcoded market picks',()=>{
  const high=company('HIGH');
  const low=company('LOW');
  low.metrics.find(m=>m.name==='Revenue')!.values=[annual(2025,80),annual(2024,100)];
  low.metrics.find(m=>m.name==='Net income')!.values=[annual(2025,-20)];
  low.metrics.find(m=>m.name==='Operating cash flow')!.values=[annual(2025,-5)];
  const ranks=rankCompanies([low,high],defaultRankWeights);
  expect(ranks.map(x=>x.ticker)).toEqual(['HIGH','LOW']);
  expect(ranks[0].score).toBeGreaterThan(ranks[1].score!);
 });
 it('will not combine cash-flow figures from mismatched fiscal period ends',()=>{
  const sample=company('MISMATCH');
  sample.metrics.find(m=>m.name==='Capital expenditures')!.values=[{...annual(2025,8),end:'2025-09-30'}];
  expect(deriveRankingMetrics(sample).fcf).toBeNull();
 });
 it('refuses to rank stale historical annual figures as fresh opportunities',()=>{
  const sample=company('STALE');
  for(const m of sample.metrics)m.values=m.values.map(v=>({...v,filed:'2023-01-01'}));
  const result=scoreCompany(sample,defaultRankWeights);
  expect(result.score).toBeNull();
  expect(result.missing).toContain('Fresh SEC fiscal financials');
 });
 it('rejects invented negative-capex accounting instead of boosting FCF',()=>{
  const sample=company('BAD');
  sample.metrics.find(m=>m.name==='Capital expenditures')!.values=[annual(2025,-100)];
  expect(deriveRankingMetrics(sample).fcf).toBeNull();
 });
it('assesses emerging FCF strength correctly - improving trend',()=>{
   // Test case 1: FCF margins -15%, -5%, +6% across 2023-2025 → improving
   const improvingCompany = {
     ticker:'IMPROVING',
     name:'Improving Inc',
     source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000000.json',
     retrievedAt:'2026-10-15T12:00:00Z',
     metrics:[
       {name:'Revenue',values:[annual(2025,100),annual(2024,100),annual(2023,100)]},
       {name:'Net income',values:[annual(2025,10),annual(2024,5),annual(2023,2)]},
       {name:'Operating cash flow',values:[annual(2025,6),annual(2024,5),annual(2023,15)]},
       {name:'Capital expenditures',values:[annual(2025,0),annual(2024,10),annual(2023,30)]}
     ]
   };
   
   const result = assessEmergingFcfStrength(withProvenance(improvingCompany));
   expect(result.status).toBe('improving');
   expect(result.years).toEqual([2025,2024,2023]);
   expect(result.margins).toEqual([6, -5, -15]); // margins calculated from FCF/revenue
  });

  it('assesses emerging FCF strength correctly - declining trend',()=>{
   // Test case 2: FCF margins +20%, +10%, +6% → not_improving
   const decliningCompany = {
     ticker:'DECLINING',
     name:'Declining Inc',
     source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json',
     retrievedAt:'2026-10-15T12:00:00Z',
     metrics:[
       {name:'Revenue',values:[annual(2025,100),annual(2024,100),annual(2023,100)]},
       {name:'Net income',values:[annual(2025,20),annual(2024,10),annual(2023,6)]},
       {name:'Operating cash flow',values:[annual(2025,6),annual(2024,10),annual(2023,20)]},
       {name:'Capital expenditures',values:[annual(2025,0),annual(2024,0),annual(2023,0)]}
     ]
   };
   
   const result = assessEmergingFcfStrength(withProvenance(decliningCompany));
   expect(result.status).toBe('not_improving');
  });

  it('assesses emerging FCF strength correctly - slightly improving',()=>{
   // Test case 3: Improving margins totaling less than 10 percentage points → not_improving
   const slightlyImprovingCompany = {
     ticker:'SLIGHTLY_IMPROVING',
     name:'Slightly Improving Inc',
     source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000002.json',
     retrievedAt:'2026-10-15T12:00:00Z',
     metrics:[
       {name:'Revenue',values:[annual(2025,100),annual(2024,100),annual(2023,100)]},
       {name:'Net income',values:[annual(2025,10),annual(2024,9),annual(2023,8)]},
       {name:'Operating cash flow',values:[annual(2025,10),annual(2024,9),annual(2023,8)]},
       {name:'Capital expenditures',values:[annual(2025,0),annual(2024,1),annual(2023,2)]}
     ]
   };
   
   const result = assessEmergingFcfStrength(withProvenance(slightlyImprovingCompany));
   expect(result.status).toBe('not_improving');
  });

  it('assesses emerging FCF strength correctly - missing fiscal year',()=>{
   // Test case 4: Missing fiscal year (2023, 2025, 2026) → insufficient_evidence
   const missingYearCompany = {
     ticker:'MISSING_YEAR',
     name:'Missing Year Inc',
     source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000003.json',
     retrievedAt:'2026-10-15T12:00:00Z',
     metrics:[
       {name:'Revenue',values:[annual(2026,100),annual(2025,100),annual(2023,100)]},
       {name:'Net income',values:[annual(2026,10),annual(2025,10),annual(2023,10)]},
       {name:'Operating cash flow',values:[annual(2026,10),annual(2025,10),annual(2023,10)]},
       {name:'Capital expenditures',values:[annual(2026,0),annual(2025,0),annual(2023,0)]}
     ]
   };
   
   const result = assessEmergingFcfStrength(withProvenance(missingYearCompany));
   expect(result.status).toBe('insufficient_evidence');
  });

  it('assesses emerging FCF strength correctly - missing data',()=>{
   // Test case 5: Missing operating cash flow or capex for one year → insufficient_evidence
   const missingDataCompany = {
     ticker:'MISSING_DATA',
     name:'Missing Data Inc',
     source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000004.json',
     retrievedAt:'2026-10-15T12:00:00Z',
     metrics:[
       {name:'Revenue',values:[annual(2025,100),annual(2024,100),annual(2023,100)]},
       {name:'Net income',values:[annual(2025,10),annual(2024,10),annual(2023,10)]},
       {name:'Operating cash flow',values:[annual(2025,10),annual(2024,10)]}, // Missing 2023
       {name:'Capital expenditures',values:[annual(2025,0),annual(2024,0),annual(2023,0)]}
     ]
   };
   
   const result = assessEmergingFcfStrength(withProvenance(missingDataCompany));
   expect(result.status).toBe('insufficient_evidence');
  });
});
