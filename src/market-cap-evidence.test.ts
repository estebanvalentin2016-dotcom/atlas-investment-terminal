import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {deriveMarketCapEvidence} from './market-cap-evidence';
import MarketCapEvidencePanel from './MarketCapEvidencePanel';
import type {MarketValuationClose,SecCompany} from './ranking-model';

const observation=(value:number,end='2026-08-01',filed='2026-08-08',accession='0000123456-26-000001')=>
 ({year:Number(end.slice(0,4)),end,filed,value,form:'10-Q',accession,tag:'EntityCommonStockSharesOutstanding'});
const company=():SecCompany=>({ticker:'UNSEEN',name:'Unseeded Issuer',retrievedAt:'2026-10-15',source:'https://data.sec.gov/api/xbrl/companyfacts/CIK0001234567.json',metrics:[
 {name:'Weighted-average diluted shares',values:[observation(11000000,'2025-12-31','2026-02-01')]},
 {name:'Common shares outstanding (DEI)',values:[observation(41000000)]}
]});
const quote=():MarketValuationClose=>({ticker:'UNSEEN',price:12,sessionDate:'2026-10-14',feed:'IEX',provider:'Alpaca',completedSession:true,splitValidation:'unverified',
 iex20:{sessionCount:20,startDate:'2026-09-16',endDate:'2026-10-14',avgDailyIexShares:45000,avgDailyIexDollarVolume:540000,coverage:'Alpaca IEX only'}});
describe('SEC point-in-time share price context without invented market cap certainty',()=>{
 it('computes only a clearly qualified indicative estimate using compatible disclosed dates',()=>{
  const out=deriveMarketCapEvidence(company(),quote(),'2026-10-15');
  expect(out.status).toBe('indicative');
  expect(out.estimate).toBe(492000000);
  expect(out.shares).toMatchObject({end:'2026-08-01',filed:'2026-08-08',accession:'0000123456-26-000001'});
  expect(out.iex20?.avgDailyIexDollarVolume).toBe(540000);
  expect(out.notes.join(' ')).toContain('unverified');
 });
 it('rejects disclosures which were not public on the stock closing date',()=>{
  const c=company();c.metrics[1].values=[observation(41000000,'2026-08-01','2026-10-16')];
  expect(deriveMarketCapEvidence(c,quote(),'2026-10-15').estimate).toBeNull();
 });
 it('refuses to multiply a stale share count or future closing price',()=>{
  const c=company();c.metrics[1].values=[observation(39000000,'2026-02-01','2026-02-08')];
  expect(deriveMarketCapEvidence(c,quote(),'2026-10-15').estimate).toBeNull();
  expect(deriveMarketCapEvidence(company(),{...quote(),sessionDate:'2026-10-17'},'2026-10-15').estimate).toBeNull();
 });
 it('does not mistake conflicting share-class candidates for an entity-wide denominator',()=>{
  const c=company();c.metrics[1].values.push(observation(33000000));
  const out=deriveMarketCapEvidence(c,quote(),'2026-10-15');
  expect(out.status).toBe('ambiguous');
  expect(out.estimate).toBeNull();
 });
 it('does not substitute fiscal-year weighted-average diluted shares for outstanding shares',()=>{
  const c=company();c.metrics=c.metrics.filter(x=>x.name!=='Common shares outstanding (DEI)');
  expect(deriveMarketCapEvidence(c,quote(),'2026-10-15').estimate).toBeNull();
 });
 it('does not misstate absent IEX-only coverage as consolidated liquidity',()=>{
  const out=deriveMarketCapEvidence(company(),{...quote(),iex20:null},'2026-10-15');
  expect(out.iex20).toBeNull();
  expect(out.status).toBe('indicative');
  expect(out.notes.join(' ')).toContain('Full 20-session IEX');
 });
 it('renders dated source and explicit provisional valuation labels',()=>{
  const html=renderToStaticMarkup(createElement(MarketCapEvidencePanel,{company:company(),quote:quote(),asOf:'2026-10-15'}));
  expect(html).toContain('Indicative equity value');
  expect(html).toContain('$492.00M');
  expect(html).toContain('Not a verified market cap');
  expect(html).toContain('2026-08-01');
  expect(html).toContain('not consolidated');
 });
});
