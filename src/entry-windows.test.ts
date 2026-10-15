import {describe,it,expect} from 'vitest';
// @ts-ignore research JS helper
import {entryWindows} from './entry-windows.mjs';
const bars=Array.from({length:26},(_,i)=>{const minutes=570+i*15;return {timeEt:String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0'),open:100+i,close:101+i,high:102+i,low:99+i}});
describe('intraday completed-bar entry windows',()=>{
 it('uses prior completed bar close for 09:45 and does not use the 09:45 bar as reference',()=>{
  const r=entryWindows(bars,true,false)[0];
  expect(r.reference).toBe(101);
  expect(r.toClose).toBeCloseTo((126/101-1)*100);
  expect(r.highest).toBeCloseTo((127/101-1)*100);
  expect(r.lowest).toBeCloseTo((100/101-1)*100);
 });
 it('uses checkpoint-specific reference and future-only extrema',()=>{
  const r=entryWindows(bars,true,false)[2];
  expect(r.reference).toBe(104);
  expect(r.lowest).toBeCloseTo((103/104-1)*100);
 });
 it('rejects incomplete or paginated history without inventing returns',()=>{
  expect(entryWindows(bars.slice(1),false,false)[0].toClose).toBeNull();
  expect(entryWindows(bars,true,true)[1].reference).toBeNull();
 });
 it('rejects malformed OHLC prices',()=>{
  const sample=bars.map(b=>({...b}));sample[1].high=50;
  expect(entryWindows(sample,true,false)[0].status).toBe('Unavailable');
 });
});
