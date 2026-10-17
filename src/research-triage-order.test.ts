import {describe,expect,it} from 'vitest';
import {compareResearchTriage,type ResearchTriageEntry} from './research-triage-order';
import type {BridgeResult} from './catalyst-fundamental-bridge';
const result=(status:BridgeResult['status'],score:number,pe:number|null,screenPass=false,topic:BridgeResult['topic']=null):BridgeResult=>({
 status,economicStatus:'unquantified',priority:status==='provisional_alignment'?score:null,financialScore:score,fyPe:pe,topic,matchedHeadline:null,screen:screenPass?{ticker:'TEST',status:'preliminary_pass',reasons:[],filed:'2026-02-15',growth:20,fcfMargin:15,netMargin:10,score}:null,
 verified:{issuerFiling:false,secAnnualFinancials:screenPass,completedClose:true},gaps:[],interpretation:'Evidence triage only'
});
const row=(ticker:string,status:BridgeResult['status'],score:number,pe:number|null,screenPass=false,topic:BridgeResult['topic']=null,historicalPass=false):ResearchTriageEntry=>({
 ticker,assessment:result(status,score,pe,screenPass,topic),filed:'2026-10-15',historicalPass
});
describe('No-buy valuation-sensitive research queue ordering',()=>{
 it('keeps source-gated alignment above unsupported catalysts and adverse SEC language',()=>{
  const rows=[
   row('CAUTION','caution',99,4),
   row('UNKNOWN','incomplete',80,12),
   row('GOOD','provisional_alignment',25,30,true,'guidance')
  ];
  rows.sort(compareResearchTriage);
  expect(rows.map(x=>x.ticker)).toEqual(['GOOD','UNKNOWN','CAUTION']);
 });
 it('does not let an extreme 120x annual P/E win merely from higher cash margin score',()=>{
  const rows=[row('ABBV','not_aligned',55,120),row('AA','not_aligned',46,9.3)];
  expect(rows.sort(compareResearchTriage).map(x=>x.ticker)).toEqual(['AA','ABBV']);
 });
 it('missing P/E never gets the favorable low-multiple rank',()=>{
  const rows=[row('MISSING','not_aligned',85,null),row('KNOWN','not_aligned',25,30)];
  expect(rows.sort(compareResearchTriage).map(x=>x.ticker)).toEqual(['KNOWN','MISSING']);
 });
 it('ranks measured source improvement above unquantified filing language only after stronger gates match',()=>{
  const reported=row('QUANT','not_aligned',30,25);
  reported.assessment.economicStatus='quantified_improvement';
  const unknown=row('UNQUANT','not_aligned',30,25);
  const ordered=[unknown,reported].sort(compareResearchTriage);
  expect(ordered[0].ticker).toBe('QUANT');
  const warning=row('ADVERSE','caution',99,12);
  warning.assessment.economicStatus='adverse_or_mixed';
  expect([warning,unknown].sort(compareResearchTriage)[0].ticker).toBe('UNQUANT');
 });
 it('saved Autonomous Discovery priority requires another fresh financial pass',()=>{
  const rows=[row('OLD','not_aligned',30,25,false,null,true),row('FRESH','not_aligned',30,25,true,null,false)];
  expect(rows.sort(compareResearchTriage)[0].ticker).toBe('FRESH');
 });
});
