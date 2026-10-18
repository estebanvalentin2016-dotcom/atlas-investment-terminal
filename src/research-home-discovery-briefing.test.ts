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
 it('renders readable scan metadata and a detailed primary lead before the existing Home dashboard',()=>{
  const storage=memoryStorage({[KEY]:JSON.stringify(briefing)});
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));

  expect(html).toContain('Oct 18, 2026');
  expect(html).toContain('5:05 PM UTC');
  expect(html).toContain('Issuers examined:</strong> 24');
  expect(html).toContain('Primary saved lead · preliminary financial screening');
  expect(html).toContain('<strong>Alpha Holdings</strong><span>AAA</span>');
  expect(html).toContain('Annual revenue growth</span><strong class="atlas-glance-value atlas-tone-positive">+12.0%');
  expect(html).toContain('FCF margin</span><strong class="atlas-glance-value atlas-tone-positive">+18.0%');
  expect(html).toContain('Indicative FY P/E</span><strong class="atlas-glance-value atlas-tone-neutral">20.0×');
  expect(html).toContain('Screening status</span><strong>Preliminary pass');
  expect(html).toContain('Emerging Strength</span><strong class="atlas-tone-positive">Improving');
  expect(html).toContain('No lead-specific limitation was saved; broader investment diligence remains outstanding.');
  expect(html).toContain('SCREENING · NOT CONVICTION');
  expect(html).toContain('NOT A BUY RATING');
  expect(html).toContain('not verified investment conviction or investment recommendations');
  expect(html).toContain('Separate research processes:');
  expect(html).toContain('They use different evidence and may reach different provisional conclusions.');
  expect(html.indexOf('Preliminary research briefing')).toBeLessThan(html.indexOf('Recent catalysts and SEC filing intelligence'));
 });

 it('renders up to two smaller alternatives and preserves unknown metrics and limitations',()=>{
  const storage=memoryStorage({[KEY]:JSON.stringify(briefing)});
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));

  expect(html.match(/Alternative research lead/g)).toHaveLength(2);
  expect(html).toContain('<strong>Beta Systems</strong><span>BBB</span>');
  expect(html).toContain('<strong>Gamma Industries</strong><span>CCC</span>');
  expect(html).toContain('Indicative FY P/E</span><strong class="atlas-glance-value atlas-tone-neutral">Unknown');
  expect(html).toContain('Known evidence limitations:</strong> Price unavailable');
  expect(html).toContain('for insurers and other specialized financial businesses');
  expect(html).toContain('Emerging Strength</span><strong class="atlas-tone-caution">Not improving');
  expect(html).toContain('Emerging Strength</span><strong class="atlas-tone-neutral">Insufficient evidence');
 });

 it('renders unavailable saved financial metrics as Unknown rather than zero',()=>{
  const unknownBriefing={...briefing,leads:[{...briefing.leads[0],revenueGrowth:null,fcfMargin:null,annualPe:null}]};
  const storage=memoryStorage({[KEY]:JSON.stringify(unknownBriefing)});
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));

  expect(html.match(/atlas-glance-value atlas-tone-neutral">Unknown/g)).toHaveLength(3);
  expect(html).not.toContain('>+0.0%</strong>');
  expect(html).not.toContain('>0.0×</strong>');
 });

 it('uses negative tones for declines and neutral tones for zero and P/E values',()=>{
  const tonalBriefing={...briefing,leads:[
   {...briefing.leads[0],revenueGrowth:-3,fcfMargin:-1.5,annualPe:4,emergingStrength:'not_improving' as const},
   {...briefing.leads[1],revenueGrowth:0,fcfMargin:0,annualPe:80,emergingStrength:'insufficient_evidence' as const}
  ]};
  const storage=memoryStorage({[KEY]:JSON.stringify(tonalBriefing)});
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));

  expect(html).toContain('atlas-glance-value atlas-tone-negative">-3.0%');
  expect(html).toContain('atlas-glance-value atlas-tone-negative">-1.5%');
  expect(html.match(/atlas-glance-value atlas-tone-neutral">0.0%/g)).toHaveLength(2);
  expect(html).toContain('atlas-glance-value atlas-tone-neutral">4.0×');
  expect(html).toContain('atlas-glance-value atlas-tone-neutral">80.0×');
 });

 it('shows an informative result when a valid saved scan has no leads',()=>{
  const emptyBriefing={...briefing,leads:[]};
  const storage=memoryStorage({[KEY]:JSON.stringify(emptyBriefing)});
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));

  expect(html).toContain('Issuers examined:</strong> 24');
  expect(html).toContain('No preliminary leads met the saved scan criteria.');
  expect(html).toContain('did not manufacture a candidate');
 });

 it('prompts for Autonomous Discovery when no saved briefing exists',()=>{
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:memoryStorage()}));

  expect(html).toContain('No saved scan is available. Run Autonomous Discovery to generate a preliminary research briefing.');
  expect(html).toContain('Recent catalysts and SEC filing intelligence');
 });

 it('handles inaccessible storage without interrupting Home rendering',()=>{
  const storage=memoryStorage();
  storage.getItem=()=>{throw new Error('Storage access denied')};

  expect(()=>renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}))).not.toThrow();
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));
  expect(html).toContain('No saved scan is available. Run Autonomous Discovery to generate a preliminary research briefing.');
  expect(html).toContain('Recent catalysts and SEC filing intelligence');
 });
});
