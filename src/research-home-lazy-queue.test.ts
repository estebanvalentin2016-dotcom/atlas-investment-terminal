import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import ResearchHome,{filingQueueActivation} from './ResearchHome';

describe('Research Home filing-intelligence disclosure',()=>{
 it('leaves the queue unmounted while closed, without hiding the saved briefing or disclosure',()=>{
  const html=renderToStaticMarkup(createElement(ResearchHome,{navigate:()=>{}}));
  expect(html).toContain('No evidence-backed lead');
  expect(html).toContain('Run Autonomous Discovery');
  expect(html).toContain('Recent catalysts and SEC filing intelligence');
  expect(html).toContain('<details class="atlas-home-secondary-intelligence">');
  expect(html).not.toContain('atlas-picks-workbench');
  expect(html).not.toContain('ATLAS is reviewing this batch');
 });

 it('activates on first opening and stays activated across later closing and opening',()=>{
  expect(filingQueueActivation(false,false)).toBe(false);
  const opened=filingQueueActivation(false,true);
  expect(opened).toBe(true);
  expect(filingQueueActivation(opened,false)).toBe(true);
  expect(filingQueueActivation(opened,true)).toBe(true);
 });
});
