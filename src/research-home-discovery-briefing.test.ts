import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import ResearchHome from './ResearchHome';
import {KEY} from './discovery-briefing-storage';
import type {DiscoveryBriefingSnapshot} from './discovery-briefing-model';

function memoryStorage(initial?:Record<string,string>):Storage {
 const entries=new Map(Object.entries(initial??{}));
 return {
  get length(){return entries.size},
  clear(){entries.clear()},
  getItem(key){return entries.get(key)??null},
  key(index){return [...entries.keys()][index]??null},
  removeItem(key){entries.delete(key)},
  setItem(key,value){entries.set(key,value)}
 };
}

const briefing:DiscoveryBriefingSnapshot={
 version:1,
 scanCompletedAt:'2026-10-18T17:05:12.000Z',
 issuersExamined:24,
 leads:[
  {ticker:'AAA',companyName:'Alpha Holdings',preliminaryScreenStatus:'preliminary_pass',revenueGrowth:12,fcfMargin:18,annualPe:20,emergingStrength:'improving',screeningReasons:['Preliminary pass'],evidenceLimitations:null},
  {ticker:'BBB',companyName:'Beta Systems',preliminaryScreenStatus:'preliminary_pass',revenueGrowth:9,fcfMargin:14,annualPe:null,emergingStrength:'not_improving',screeningReasons:['Preliminary pass'],evidenceLimitations:['Price unavailable']},
  {ticker:'CCC',companyName:'Gamma Industries',preliminaryScreenStatus:'preliminary_pass',revenueGrowth:7,fcfMargin:11,annualPe:25,emergingStrength:'insufficient_evidence',screeningReasons:['Preliminary pass'],evidenceLimitations:null}
 ]
};

describe('Research Home saved Autonomous Discovery briefing',()=>{
 it('renders a dominant evidence-backed lead before the subordinate filing queue',()=>{
  const storage=memoryStorage({[KEY]:JSON.stringify(briefing)});
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},onResearch:()=>{},briefingStorage:storage}));

  expect(html).toContain('Oct 18, 2026');
  expect(html).toContain('5:05 PM UTC');
  expect(html).toContain('<header class="atlas-home-hero">');
  expect(html).toContain('AAA surfaced first.');
  expect(html).toContain('The screen is preliminary.');
  expect(html).toContain('<strong>24</strong><span>issuers examined in the saved scan');
  expect(html).toContain('Featured research lead');
  expect(html).toContain('aria-label="Featured preliminary research lead AAA"');
  expect(html).toContain('<span class="atlas-home-ticker">AAA</span><h3>Alpha Holdings</h3>');
  expect(html).toContain('Preliminary classification</span><strong>Preliminary pass');
  expect(html).toContain('Investigate AAA');
  expect(html).toContain('Annual revenue growth</span><strong class="atlas-tone-positive">+12.0%');
  expect(html).toContain('FCF margin</span><strong class="atlas-tone-positive">+18.0%');
  expect(html).toContain('Indicative FY P/E</span><strong class="atlas-tone-neutral">20.0×');
  expect(html).toContain('Preliminary triage</span><strong>Investigate further');
  expect(html).toContain('Emerging Strength</span><strong class="atlas-tone-positive">Improving');
  expect(html).toContain('<strong>Reason for attention.</strong> Preliminary pass');
  expect(html).toContain('No lead-specific limitation was saved; broader investment diligence remains outstanding.');
  expect(html).toContain('Screening · not conviction');
  expect(html).toContain('Not an investment recommendation');
  expect(html).toContain('not verified investment conviction or an investment recommendation');
  expect(html).toContain('The version 1 briefing does not retain source URLs, catalyst evidence, historical pre-news proof, or a comparative ranking score.');
  expect(html).toContain('<details class="atlas-home-secondary-intelligence">');
  expect(html.indexOf('AAA surfaced first.')).toBeLessThan(html.indexOf('Saved discovery scan summary'));
  expect(html.indexOf('AAA surfaced first.')).toBeLessThan(html.indexOf('Recent catalysts and SEC filing intelligence'));
 });

 it('renders up to two editorial alternatives without inventing comparative evidence',()=>{
  const storage=memoryStorage({[KEY]:JSON.stringify(briefing)});
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));

  expect(html).toContain('Alternative saved leads');
  expect(html).toContain('<strong>BBB</strong><span>Beta Systems</span>');
  expect(html).toContain('<strong>CCC</strong><span>Gamma Industries</span>');
  expect(html).toContain('Price unavailable');
  expect(html).toContain('the snapshot does not preserve a comparative score or rejection rationale');
  expect(html).toContain('for insurers and other specialized financial businesses');
  expect(html).not.toContain('Aurum Infrastructure');
  expect(html).not.toContain('Beneficiary universe');
 });

 it('renders unavailable saved financial metrics as Unknown rather than zero',()=>{
  const unknownBriefing={...briefing,leads:[{...briefing.leads[0],revenueGrowth:null,fcfMargin:null,annualPe:null}]};
  const storage=memoryStorage({[KEY]:JSON.stringify(unknownBriefing)});
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));

  expect((html.match(/class="atlas-tone-neutral">Unknown/g)??[]).length).toBeGreaterThanOrEqual(3);
  expect(html).not.toContain('>+0.0%</strong>');
  expect(html).not.toContain('>0.0×</strong>');
 });

 it('uses negative tones for declines and neutral tones for zero and P/E values',()=>{
  const tonalBriefing={...briefing,leads:[
   {...briefing.leads[0],revenueGrowth:-3,fcfMargin:-1.5,annualPe:4,emergingStrength:'not_improving' as const}
  ]};
  const storage=memoryStorage({[KEY]:JSON.stringify(tonalBriefing)});
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));

  expect(html).toContain('class="atlas-tone-negative">-3.0%');
  expect(html).toContain('class="atlas-tone-negative">-1.5%');
  expect(html).toContain('class="atlas-tone-neutral">4.0×');

  const zeroBriefing={...briefing,leads:[{...briefing.leads[0],revenueGrowth:0,fcfMargin:0,annualPe:80}]};
  const zeroHtml=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:memoryStorage({[KEY]:JSON.stringify(zeroBriefing)})}));
  expect((zeroHtml.match(/class="atlas-tone-neutral">0.0%/g)??[]).length).toBeGreaterThanOrEqual(2);
  expect(zeroHtml).toContain('class="atlas-tone-neutral">80.0×');
 });

 it('shows an evidence-honest result when a valid saved scan has no leads',()=>{
  const emptyBriefing={...briefing,leads:[]};
  const storage=memoryStorage({[KEY]:JSON.stringify(emptyBriefing)});
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));

  expect(html).toContain('No lead met its saved criteria.');
  expect(html).toContain('24 real issuers were examined');
  expect(html).toContain('rather than promoting an unsupported candidate');
 });

 it('shows a sophisticated empty state when no saved briefing exists',()=>{
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:memoryStorage()}));

  expect(html).toContain('No evidence-backed lead');
  expect(html).toContain('Run Autonomous Discovery to examine real SEC issuers');
  expect(html).toContain('ATLAS will not manufacture a company, catalyst, or conviction signal');
  expect(html).toContain('Recent catalysts and SEC filing intelligence');
 });

 it('handles inaccessible storage without interrupting Home rendering',()=>{
  const storage=memoryStorage();
  storage.getItem=()=>{throw new Error('Storage access denied')};

  expect(()=>renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}))).not.toThrow();
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));
  expect(html).toContain('No evidence-backed lead');
  expect(html).toContain('Recent catalysts and SEC filing intelligence');
 });
});
