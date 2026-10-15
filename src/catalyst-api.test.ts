import {describe,it,expect} from 'vitest';
// @ts-ignore Node SEC middleware
import {recentCatalysts} from '../server/catalyst-api.mjs';
describe('SEC catalyst normalization',()=>{
 it('includes 8-K filings only and links original SEC documents',()=>{
 const data={filings:{recent:{form:['10-K','8-K','8-K/A'],accessionNumber:['0000000001-26-000001','0000000001-26-000002','0000000001-26-000003'],filingDate:['2026-01-01','2026-02-02','2026-03-03'],primaryDocument:['annual.htm','event.htm','amended.htm'],items:['','2.02','3.02']}}};
 const rows=recentCatalysts(data,'0000000001');expect(rows).toHaveLength(2);expect(rows[0].labels).toContain('Results of operations');expect(rows[0].url).toContain('/Archives/edgar/data/1/000000000126000002/event.htm');expect(rows[1].labels).toContain('Unregistered securities');
 });
 it('rejects missing submissions structures',()=>expect(()=>recentCatalysts({},'1')).toThrow());
 it('skips invalid document paths',()=>{const data={filings:{recent:{form:['8-K'],accessionNumber:['0000000001-26-000001'],filingDate:['2026-02-02'],primaryDocument:['../evil.htm']}}};expect(recentCatalysts(data,'1')).toEqual([])});
});
