import {describe,it,expect} from 'vitest';
// @ts-ignore Node-only adapter
import {overnightClock,overnightSummary,handleOvernightRequest} from '../server/overnight-api.mjs';
describe('overnight historical feasibility',()=>{
 it('converts UTC times to overnight Eastern clock across DST',()=>{expect(overnightClock('2026-08-27T06:00:00Z').minute).toBe(120);expect(overnightClock('2026-12-01T07:00:00Z').minute).toBe(120)});
 it('filters outside overnight session and includes only actual provided bars',()=>{const x=overnightSummary({bars:[{t:'2026-08-27T05:45:00Z',o:10,h:11,l:9,c:10,v:50},{t:'2026-08-27T06:00:00Z',o:11,h:12,l:10,c:11,v:80},{t:'2026-08-27T14:00:00Z',o:14,h:15,l:13,c:14,v:50}]},'2026-08-27');expect(x.barCount).toBe(2);expect(x.near2amBars).toBe(2);expect(x.robinhoodHistoricalEligibility).toBe('Unknown');expect(x.executionPrice).toBe('Unknown')});
 it('does not intercept other endpoints',async()=>expect(await handleOvernightRequest({url:'/api/market/daily'},{})).toBe(false));
});
