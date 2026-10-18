import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import FinancingAutomationPanel from './FinancingAutomationPanel';
import type {Annual,SecCompany,SecMetric} from './ranking-model';

const filed=(val:number,end='2026-06-30',filed='2026-08-08'):Annual=>
 ({year:Number(end.slice(0,4)),end,filed,value:val,form:'10-Q',accession:'0000123456-26-000001'});
const annual=(value:number):Annual=>({year:2025,end:'2025-12-31',filed:'2026-02-15',value,form:'10-K',accession:'0000123456-26-000002'});
const item=(name:string,values:Annual[]):SecMetric=>({name,values});

// Test case with all debt components available
const fullCompany=():SecCompany=>({ticker:'TEST',name:'Test Industry',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000123456.json',retrievedAt:'2026-10-15',metrics:[
 item('Revenue',[annual(20000000),{...annual(18000000),year:2024,end:'2024-12-31',filed:'2025-02-15'}]),
 item('Operating cash flow',[annual(3000000)]),
 item('Capital expenditures',[annual(5000000)]),
 item('Weighted-average diluted shares',[annual(13600)]),
 item('Common shares outstanding (DEI)',[filed(12880000,'2026-09-03','2026-09-08')]),
 item('Latest cash and cash equivalents',[filed(10000000)]),
 item('Latest current assets',[filed(20000000)]),
 item('Latest current liabilities',[filed(12000000)]),
 item('Latest current long-term debt',[filed(1000000)]),
 item('Latest noncurrent long-term debt',[filed(3000000)]),
 item('Latest short-term borrowings',[filed(200000)]),
]});

// Test case with one missing debt component
const partialCompany=():SecCompany=>({ticker:'TEST',name:'Test Industry',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000123456.json',retrievedAt:'2026-10-15',metrics:[
 item('Revenue',[annual(20000000),{...annual(18000000),year:2024,end:'2024-12-31',filed:'2025-02-15'}]),
 item('Operating cash flow',[annual(3000000)]),
 item('Capital expenditures',[annual(5000000)]),
 item('Weighted-average diluted shares',[annual(13600)]),
 item('Common shares outstanding (DEI)',[filed(12880000,'2026-09-03','2026-09-08')]),
 item('Latest cash and cash equivalents',[filed(10000000)]),
 item('Latest current assets',[filed(20000000)]),
 item('Latest current liabilities',[filed(12000000)]),
 item('Latest current long-term debt',[filed(1000000)]),
 item('Latest noncurrent long-term debt',[]), // Missing this one
 item('Latest short-term borrowings',[filed(200000)]),
]});

// Test case with zero debt value (should still show as "reported")
const zeroCompany=():SecCompany=>({ticker:'TEST',name:'Test Industry',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0000123456.json',retrievedAt:'2026-10-15',metrics:[
 item('Revenue',[annual(20000000),{...annual(18000000),year:2024,end:'2024-12-31',filed:'2025-02-15'}]),
 item('Operating cash flow',[annual(3000000)]),
 item('Capital expenditures',[annual(5000000)]),
 item('Weighted-average diluted shares',[annual(13600)]),
 item('Common shares outstanding (DEI)',[filed(12880000,'2026-09-03','2026-09-08')]),
 item('Latest cash and cash equivalents',[filed(10000000)]),
 item('Latest current assets',[filed(20000000)]),
 item('Latest current liabilities',[filed(12000000)]),
 item('Latest current long-term debt',[filed(0)]),
 item('Latest noncurrent long-term debt',[filed(0)]),
 item('Latest short-term borrowings',[filed(0)]),
]});

describe('Debt Component Presentation',()=>{
 it('labels all tracked components as a supported subtotal, not total company debt',()=>{
  const html=renderToStaticMarkup(createElement(FinancingAutomationPanel,{company:fullCompany(),asOf:'2026-10-15'}));
  expect(html).toContain('Supported debt-component subtotal');
  expect(html).toContain('Identified component subtotal:');
  expect(html).toContain('$4.2M');
  expect(html).toContain('Total company debt remains unverified because leases, convertible instruments, other borrowings, classifications, and maturities have not been reconciled.');
  expect(html).not.toContain('Debt subtotal verified from complete evidence');
  expect(html).not.toContain('Total debt:');
  expect(html).toContain('atlas-debt-subtotal-complete');
  expect(html).toContain('Current portion of long-term debt');
  expect(html).toContain('Noncurrent long-term debt');
  expect(html).toContain('Short-term borrowings');
 });

 it('shows incomplete debt summary when components missing',()=>{
  const html=renderToStaticMarkup(createElement(FinancingAutomationPanel,{company:partialCompany(),asOf:'2026-10-15'}));
  expect(html).toContain('Supported debt-component subtotal unavailable');
  expect(html).toContain('atlas-debt-subtotal-incomplete');
  expect(html).toContain('Missing 1 of 3 tracked debt components');
  expect(html).toContain('ATLAS does not calculate the identified component subtotal when tracked component evidence is incomplete.');
  expect(html).toContain('Total company debt remains unverified because leases, convertible instruments, other borrowings, classifications, and maturities have not been reconciled.');
  expect(html).not.toContain('Identified component subtotal:');
 });

 it('clearly shows reported zero debt values',()=>{
  const html=renderToStaticMarkup(createElement(FinancingAutomationPanel,{company:zeroCompany(),asOf:'2026-10-15'}));
  // All should show as "report zero" not unavailable
  expect(html).toContain('atlas-debt-component-reported-zero');
  expect(html).toContain('Current portion of long-term debt');
  expect(html).toContain('Noncurrent long-term debt');
  expect(html).toContain('Short-term borrowings');
 });
});
