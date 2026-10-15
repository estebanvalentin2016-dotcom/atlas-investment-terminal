import {describe,it,expect} from 'vitest';
// @ts-ignore Node middleware module
import {summarizeIntraday,marketClock,handleIntradayRequest} from '../server/intraday-api.mjs';
describe('historical intraday coverage probe',()=>{
 it('converts UTC bars to New York market clock',()=>{
  expect(marketClock('2026-08-27T13:30:00Z')).toEqual({date:'2026-08-27',minutes:570});
  expect(marketClock('2026-12-01T14:30:00Z')).toEqual({date:'2026-12-01',minutes:570});
 });
 it('keeps only valid regular-session bars and reports gaps',()=>{
  const data={bars:[{t:'2026-08-27T12:00:00Z',o:10,h:11,l:9,c:10,v:5},{t:'2026-08-27T13:30:00Z',o:10,h:11,l:9,c:10,v:10},{t:'2026-08-27T14:00:00Z',o:10,h:11,l:9,c:10,v:12}],next_page_token:'more'};
  const r=summarizeIntraday(data,'2026-08-27');
  expect(r.barCount).toBe(2);expect(r.firstBarTimeEt).toBe('09:30');expect(r.fullRegularSession).toBe(false);expect(r.partialHistory).toBe(true);
 });
 it('does not treat invalid high and low values as valid coverage',()=>{
  const r=summarizeIntraday({bars:[{t:'2026-08-27T13:30:00Z',o:10,h:8,l:12,c:10,v:10}]},'2026-08-27');
  expect(r.barCount).toBe(0);
 });
 it('does not intercept unrelated routes',async()=>{
  expect(await handleIntradayRequest({url:'/api/market/daily'},{})).toBe(false);
 });
});
