import {describe,it,expect} from 'vitest';
// @ts-ignore JS-only provenance helper
import {assessPublication} from './publication-timeline.mjs';
describe('publication provenance screening',()=>{
 it('never treats an absent publication timestamp as available',()=>expect(assessPublication('', '2026-08-27').map((x:{status:string})=>x.status)).toEqual(['Unknown','Unknown','Unknown']));
 it('flags later same-session publication instead of relying on SEC acceptance',()=>expect(assessPublication('2026-08-27T10:15','2026-08-27').map((x:{status:string})=>x.status)).toEqual(['After checkpoint','After checkpoint','Published by checkpoint (user-reported)']));
 it('treats a documented previous-day publication as chronologically prior',()=>expect(assessPublication('2026-08-26T20:07','2026-08-27')[0].status).toContain('user-reported'));
 it('rejects invalid dates and times',()=>{expect(assessPublication('2026-02-30T09:00','2026-08-27')[0].status).toBe('Unknown');expect(assessPublication('2026-08-27T25:20','2026-08-27')[0].status).toBe('Unknown')});
});
