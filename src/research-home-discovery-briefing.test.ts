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
 it('renders valid saved scan metadata and preliminary leads before the existing Home dashboard',()=>{
  const storage=memoryStorage({[KEY]:JSON.stringify(briefing)});
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));

  expect(html).toContain('2026-10-18T17:05:12.000Z');
  expect(html).toContain('Companies examined:</strong> 24');
  for(const lead of ['AAA · Alpha Holdings','BBB · Beta Systems','CCC · Gamma Industries'])expect(html).toContain(lead);
  expect(html).toContain('Preliminary research leads — not investment recommendations.');
  expect(html.indexOf('Autonomous Discovery Briefing')).toBeLessThan(html.indexOf('What deserves attention right now?'));
 });

 it('prompts for Autonomous Discovery when no saved briefing exists',()=>{
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:memoryStorage()}));

  expect(html).toContain('Run Autonomous Discovery to generate a research briefing.');
  expect(html).toContain('What deserves attention right now?');
 });

 it('handles inaccessible storage without interrupting Home rendering',()=>{
  const storage=memoryStorage();
  storage.getItem=()=>{throw new Error('Storage access denied')};

  expect(()=>renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}))).not.toThrow();
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{},briefingStorage:storage}));
  expect(html).toContain('Run Autonomous Discovery to generate a research briefing.');
  expect(html).toContain('What deserves attention right now?');
 });
});
