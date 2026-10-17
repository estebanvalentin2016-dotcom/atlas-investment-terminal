import {describe,it,expect} from 'vitest';
// @ts-ignore JS-only triage helper
import {triageFilings} from './opportunity-triage.mjs';
const now=Date.parse('2026-10-15T12:00:00Z');
const f=(acceptedAt:string,items:string,accession='a')=>({acceptedAt,items,accession,url:'https://www.sec.gov/Archives/a'});
describe('opportunity discovery triage',()=>{
 it('prioritizes recent earnings disclosure without classifying it bullish',()=>{const rows=triageFilings([{ticker:'AAA',filings:[f('2026-10-14T12:00:00Z','1.01')]},{ticker:'BBB',filings:[f('2026-10-13T12:00:00Z','2.02')]}],now);expect(rows.map((x:{ticker:string})=>x.ticker)).toEqual(['BBB','AAA']);expect(rows[0].kind).toBe('Earnings disclosure')});
 it('rejects old, future, unrelated and undated filings',()=>expect(triageFilings([{ticker:'ABC',filings:[f('2026-09-01T12:00:00Z','2.02'),f('2026-10-18T12:00:00Z','2.02'),f('2026-10-14T12:00:00Z','5.02'),f('', '2.02')]}],now)).toEqual([]));
 it('does not misinterpret similar item codes',()=>expect(triageFilings([{ticker:'ABC',filings:[f('2026-10-14T12:00:00Z','12.02')]}],now)).toEqual([]));
});
