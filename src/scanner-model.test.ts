import {describe,it,expect} from 'vitest';
import {assessCandidate,parseWatchlist,type DailySummary} from './scanner-model';
const row:DailySummary={date:'2026-10-14',close:20,volume:200,day1:2,day3:6,day5:9,rvol:2,below20DayHighPct:-2};
describe('watchlist scanner research rules',()=>{
 it('deduplicates and limits ticker inputs',()=>expect(parseWatchlist('crwd, nvda CRWD;panw')).toEqual(['CRWD','NVDA','PANW']));
 it('requires all metrics for classification',()=>expect(assessCandidate({...row,rvol:null}).direction).toBe('Insufficient data'));
 it('labels bullish research candidates',()=>expect(assessCandidate(row).direction).toBe('Bullish follow-through candidate'));
 it('labels bearish research candidates',()=>expect(assessCandidate({...row,day1:-2,day3:-7,day5:-10}).direction).toBe('Bearish follow-through candidate'));
 it('does not label low volume as confirmed follow-through',()=>expect(assessCandidate({...row,rvol:0.8}).direction).toBe('No qualifying pattern'));
});
