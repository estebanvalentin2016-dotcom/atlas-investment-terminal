import {describe,expect,it,vi} from 'vitest';
import {appendMacroEvidence,ingestOfficialMacroRelease,macroEvidenceAsOf,normalizeOfficialMacroEvidence} from '../server/official-macro-evidence.mjs';

const retrievedAt='2026-10-20T18:00:00.000Z';
const base={eventType:'cpi',sourceUrl:'https://www.bls.gov/news.release/cpi.nr0.htm',publishedAt:'2026-10-14T12:30:00.000Z',publishedTimeZone:'America/New_York',referencePeriod:'2026-09',retrievedAt,observations:[{key:'cpi_monthly_change',value:0.6,unit:'percent'}]};
const html=(body:string)=>`<html><body>${body}</body></html>`;
const response=(body:string)=>({ok:true,text:async()=>html(body)});
const valid=(input:Record<string,unknown>)=>{const result=normalizeOfficialMacroEvidence(input);if(result.status!=='official_observation')throw Error(result.reason);return result};
const unavailable=(input:Record<string,unknown>)=>{const result=normalizeOfficialMacroEvidence(input);if(result.status!=='unavailable')throw Error('Expected unavailable');return result};
const ingested=async(options:Parameters<typeof ingestOfficialMacroRelease>[0])=>{const result=await ingestOfficialMacroRelease(options);if(result.status!=='official_observation')throw Error(result.reason);return result};

describe('experimental official macro evidence',()=>{
 it('accepts official CPI observations, explicit zero and source chronology',()=>{
  const record=valid({...base,observations:[{key:'cpi_monthly_change',value:0,unit:'percent'}]});
  expect(record.status).toBe('official_observation');expect(record.observations[0].value).toBe(0);
  expect(record.companySpecificEvidence).toBeNull();expect(record.analystInterpretation).toBeNull();
  expect(macroEvidenceAsOf([record],'2026-10-19T00:00:00.000Z')).toEqual([]);
  expect(macroEvidenceAsOf([record],'2026-10-20T18:00:00.000Z')).toEqual([record]);
 });
 it('rejects missing/future release dates, wrong units, duplicate metrics and nonofficial URLs',()=>{
  expect(unavailable({...base,publishedAt:null}).reason).toBe('publication_time_unverified');
  expect(unavailable({...base,publishedAt:'2026-10-21T12:30:00.000Z'}).reason).toBe('future_publication');
  expect(unavailable({...base,observations:[{key:'cpi_monthly_change',value:0.6,unit:'persons'}]}).reason).toBe('invalid_observation_or_unit');
  expect(unavailable({...base,observations:[...base.observations,...base.observations]}).reason).toBe('duplicate_observation');
  expect(unavailable({...base,sourceUrl:'https://evil.test/news.release/cpi.nr0.htm'}).reason).toBe('unverified_official_source');
 });
 it('retains revised observations as separate retrieved vintages and blocks later revisions as of earlier times',()=>{
  const original=valid(base);
  const revised=valid({...base,retrievedAt:'2026-10-22T18:00:00.000Z',observations:[{key:'cpi_monthly_change',value:0.5,unit:'percent'}],revision:{status:'revised',publishedAt:'2026-10-22T12:00:00.000Z',note:'Official correction'}});
  const unchangedRefetch=valid({...base,retrievedAt:'2026-10-21T18:00:00.000Z'});
  const list=appendMacroEvidence(appendMacroEvidence([original],unchangedRefetch),revised);
  expect(list).toHaveLength(2);expect(list[0].id).toBe(list[1].id);
  expect(macroEvidenceAsOf(list,'2026-10-21T12:00:00.000Z')).toEqual([original]);
  expect(macroEvidenceAsOf(list,'2026-10-23T12:00:00.000Z')).toHaveLength(2);
 });
 it('ingests bounded CPI release text with BLS embargo time and reference period',async()=>{
  const fetchImpl=vi.fn(async()=>response('Transmission of material in this release is embargoed until 8:30 a.m. (ET) Wednesday, October 14, 2026 CONSUMER PRICE INDEX - SEPTEMBER 2026 The Consumer Price Index for All Urban Consumers (CPI-U) increased 0.6 percent on a seasonally adjusted basis in September. Over the last 12 months, the all items index increased 3.7 percent before seasonal adjustment.'));
  const record=await ingested({eventType:'cpi',fetchImpl,now:()=>new Date(retrievedAt)});
  expect(record.status).toBe('official_observation');expect(record.source.publishedAt).toBe('2026-10-14T12:30:00.000Z');
  expect(record.observations.map((x:any)=>[x.key,x.value,x.unit])).toEqual([['cpi_monthly_change',0.6,'percent'],['cpi_annual_change',3.7,'percent']]);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
 });
 it('ingests BLS employment and a Fed target range without inferring company effects',async()=>{
  const employment=await ingested({eventType:'employment',fetchImpl:async()=>response('Transmission of material in this news release is embargoed until 8:30 a.m. (ET) Friday, October 2, 2026 THE EMPLOYMENT SITUATION - SEPTEMBER 2026 Both nonfarm payroll employment (+29,000) and the unemployment rate (4.2 percent) changed little in September.'),now:()=>new Date(retrievedAt)});
  expect(employment.observations.map((x:any)=>x.value)).toEqual([29000,4.2]);
  const fomc=await ingested({eventType:'fomc',sourceUrl:'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260318a.htm',fetchImpl:async()=>response('March 18, 2026 Federal Reserve issues FOMC statement For release at 2:00 p.m. EDT The Committee decided to maintain the target range for the federal funds rate at 3‑1/2 to 3‑3/4 percent.'),now:()=>new Date(retrievedAt)});
  expect(fomc.source.publishedAt).toBe('2026-03-18T18:00:00.000Z');
  expect(fomc.source.publicationTimeBasis).toBe('official_for_release_at');
  expect(fomc.observations.map((x:any)=>x.value)).toEqual([3.5,3.75]);
  expect(fomc.possibleTransmissionMechanism).toBeNull();
  const mismatch=await ingestOfficialMacroRelease({eventType:'fomc',sourceUrl:'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260318a.htm',fetchImpl:async()=>response('March 19, 2026 For release at 2:00 p.m. EDT'),now:()=>new Date(retrievedAt)});
  expect(mismatch.status).toBe('unavailable');
 });
 it('returns unavailable when publication metadata or source is unavailable',async()=>{
  const missing=await ingestOfficialMacroRelease({eventType:'cpi',fetchImpl:async()=>response('CPI headline without release clock'),now:()=>new Date(retrievedAt)});
  if(missing.status!=='unavailable')throw Error('Expected unavailable');
  expect(missing.reason).toBe('publication_or_period_unverified');
  const unavailable=await ingestOfficialMacroRelease({eventType:'cpi',fetchImpl:async()=>{throw Error('network denied')},now:()=>new Date(retrievedAt)});
  if(unavailable.status!=='unavailable')throw Error('Expected unavailable');
  expect(unavailable.reason).toBe('source_retrieval_failed');
  expect(macroEvidenceAsOf([valid(base)],'invalid')).toEqual([]);
 });
});
