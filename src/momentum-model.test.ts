import {describe,it,expect} from 'vitest';
import {assessMomentum} from './momentum-model';
describe('manual momentum arithmetic',()=>{
 it('calculates returns and relative volume',()=>{const r=assessMomentum({priorClose:10,latestClose:11,priorVolume:300000,averageVolume:100000});expect(r?.returnPct).toBeCloseTo(10);expect(r?.relativeVolume).toBeCloseTo(3)});
 it('rejects missing or invalid denominators',()=>expect(assessMomentum({priorClose:0,latestClose:11,priorVolume:100,averageVolume:0})).toBeNull());
});
