import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseProviderFundCSV} from './fund-csv-adapters';
import FundCSVImport from './FundCSVImport';
const ishares='https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf';
const spdr='https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy';
const vanguard='https://investor.vanguard.com/investment-products/etfs/profile/voo';
describe('Provider-specific local fund holdings CSV import',()=>{
 it('parses original iShares-style CSV columns and holdings as-of metadata',()=>{
  const csv='"Fund Holdings as of","Sep 25, 2026"\nTicker,Name,Sector,Asset Class,Market Value,Weight (%),Notional Value,Quantity,CUSIP,ISIN\nNVDA,NVIDIA CORP,IT,Equity,"$69,445,195,802.00",8.22,"$69,445,195,802.00","310,480,600.00",67066G104,US67066G1040\n';
  const result=parseProviderFundCSV(csv,'iShares','IVV',ishares);
  expect(result.positions).toHaveLength(1);
  expect(result.asOfDate).toBe('2026-09-25');
  expect(result.positions[0]).toMatchObject({ticker:'NVDA',issuer:'NVIDIA CORP',cusip:'67066G104',shares:310480600,weightPct:8.22,marketValue:69445195802});
  expect(result.publishedDate).toBeNull();
  expect(result.sourceVerification).toBe('user_supplied_unverified');
 });
 it('reads SPDR-style share and portfolio weight fields',()=>{
  const csv='"Fund Holdings as of","Oct 12, 2026"\nName,CUSIP,Shares Held,Weight (%)\nNVIDIA CORP,67066G104,"296,187,117",8.14\n';
  const result=parseProviderFundCSV(csv,'SPDR','SPY',spdr);
  expect(result.positions[0]).toMatchObject({cusip:'67066G104',shares:296187117,weightPct:8.14});
 });
 it('accepts Vanguard-style CSV when verified US CUSIP columns are provided',()=>{
  const csv='Name,CUSIP,Shares,Weight\nAPPLE INC,037833100,1850,7.20\n';
  const result=parseProviderFundCSV(csv,'Vanguard','VOO',vanguard);
  expect(result.asOfDate).toBeNull();
  expect(result.positions[0].issuer).toBe('APPLE INC');
 });
 it('rejects forged provider URLs and unsupported report shapes',()=>{
  const csv='Name,CUSIP,Shares\nACME,037833100,200\n';
  expect(()=>parseProviderFundCSV(csv,'SPDR','SPY','https://untrusted.example/download.csv')).toThrow('official HTTPS');
  expect(()=>parseProviderFundCSV('Ticker,Name,Price\nNVDA,NVIDIA,5','iShares','IVV',ishares)).toThrow('recognized');
 });
 it('does not infer holdings as-of or publication dates from file upload or current clock',()=>{
  const csv='Name,CUSIP,Shares\nACME,037833100,200\n';
  const report=parseProviderFundCSV(csv,'SPDR','SPY',spdr);
  expect(report.asOfDate).toBeNull();
  expect(report.publishedDate).toBeNull();
  expect(report.coverage).toContain('excluded from active-institution consensus');
 });
 it('shows fund provider selection and clearly labels imported data limitations',()=>{
  const html=renderToStaticMarkup(createElement(FundCSVImport));
  expect(html).toContain('Import an official fund holdings CSV');
  expect(html).toContain('Vanguard');
  expect(html).toContain('iShares');
  expect(html).toContain('SPDR');
  expect(html).toContain('does not silently scrape');
 });
});
