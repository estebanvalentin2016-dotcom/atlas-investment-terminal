import {describe,it,expect} from 'vitest';
import {companies,calculateValuation,opportunityScore,startingInputs,makeScenarios} from './model';
describe('financial calculations',()=>{
 it('preserves return when future market cap equals current cap with no dilution',()=>{const c=companies[0];const r=calculateValuation(c,{growth:0,margin:20,pe:c.marketCap/(c.revenue*.2),years:5,dilution:0});expect(r.totalReturn).toBeCloseTo(0,7);expect(r.impliedPrice).toBeCloseTo(c.price,7)});
 it('dilution lowers implied per-share price',()=>{const c=companies[0];const a=calculateValuation(c,{...startingInputs(c),dilution:0});const b=calculateValuation(c,{...startingInputs(c),dilution:3});expect(b.impliedPrice).toBeLessThan(a.impliedPrice)});
 it('scores remain in range',()=>{for(const c of companies){const s=opportunityScore(c);expect(s.total).toBeGreaterThanOrEqual(0);expect(s.total).toBeLessThanOrEqual(100)}});
 it('bear scenario underperforms bull scenario',()=>{const c=companies[1];const [bear,,bull]=makeScenarios(startingInputs(c));expect(calculateValuation(c,bear.inputs).impliedPrice).toBeLessThan(calculateValuation(c,bull.inputs).impliedPrice)});
});
