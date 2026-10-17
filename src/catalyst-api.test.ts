import {describe,it,expect} from 'vitest';
// @ts-ignore Node SEC middleware
import {recentCatalysts} from '../server/catalyst-api.mjs';
describe('SEC catalyst normalization',()=>{
 it('includes 8-K filings only and links original SEC documents',()=>{
 const data={filings:{recent:{form:['10-K','8-K','8-K/A'],accessionNumber:['0000000001-26-000001','0000000001-26-000002','0000000001-26-000003'],filingDate:['2026-01-01','2026-02-02','2026-03-03'],primaryDocument:['annual.htm','event.htm','amended.htm'],acceptanceDateTime:['2026-01-01T10:00:00Z','2026-02-02T21:10:00Z','2026-03-03T15:02:00Z'],items:['','2.02','3.02']}}};
 const rows=recentCatalysts(data,'0000000001');expect(rows).toHaveLength(2);expect(rows[0].labels).toContain('Results of operations');expect(rows[0].acceptedAt).toBe('2026-02-02T21:10:00Z');expect(rows[0].url).toContain('/Archives/edgar/data/1/000000000126000002/event.htm');expect(rows[1].labels).toContain('Unregistered securities');
 });
 it('does not invent a timestamp when SEC omits it or supplies ambiguous local time',()=>{const data={filings:{recent:{form:['8-K','8-K'],accessionNumber:['0000000001-26-000004','0000000001-26-000005'],filingDate:['2026-02-04','2026-02-05'],primaryDocument:['a.htm','b.htm'],acceptanceDateTime:['2026-02-04T16:00:00','2026-02-05T21:00:00Z']}}};const rows=recentCatalysts(data,'1');expect(rows[0].acceptedAt).toBeNull();expect(rows[1].acceptedAt).toBe('2026-02-05T21:00:00Z')});
 it('rejects missing submissions structures',()=>expect(()=>recentCatalysts({},'1')).toThrow());
 it('skips invalid document paths',()=>{const data={filings:{recent:{form:['8-K'],accessionNumber:['0000000001-26-000001'],filingDate:['2026-02-02'],primaryDocument:['../evil.htm']}}};expect(recentCatalysts(data,'1')).toEqual([])});
});
