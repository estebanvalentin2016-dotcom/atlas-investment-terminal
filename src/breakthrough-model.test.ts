import {describe,expect,it} from 'vitest';
import {validEvidenceUrl} from './breakthrough-model';
describe('research source URLs',()=>{
 it('accepts secure links',()=>expect(validEvidenceUrl('https://www.sec.gov/Archives/edgar/data/123')).toBe(true));
 it('rejects script and file URLs',()=>{expect(validEvidenceUrl('javascript:alert(1)')).toBe(false);expect(validEvidenceUrl('file:///tmp/file')).toBe(false)});
 it('rejects malformed URLs',()=>expect(validEvidenceUrl('not-a-url')).toBe(false));
});
