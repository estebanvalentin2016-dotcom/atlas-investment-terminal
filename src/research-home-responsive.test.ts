// @ts-expect-error Tests execute in Node; this project intentionally omits Node type declarations.
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const shellCss=readFileSync(new URL('./private-wealth.css',import.meta.url),'utf8');
const homeCss=readFileSync(new URL('./research-home.css',import.meta.url),'utf8');

describe('Research Home responsive containment',()=>{
 it('keeps the closed mobile navigation inside the viewport instead of translating it into page overflow',()=>{
  expect(shellCss).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.workspace-navigation \{[\s\S]*?clip-path: inset\(0 0 0 100%\);[\s\S]*?pointer-events: none;/);
  expect(shellCss).toMatch(/\.workspace-navigation\.sidebar-open \{[\s\S]*?clip-path: inset\(0\);[\s\S]*?pointer-events: auto;/);
 });

 it('allows long mobile research evidence and actions to shrink and wrap within Home',()=>{
  expect(homeCss).toMatch(/\.workspace-shell \.atlas-research-home \{[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/);
  expect(homeCss).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.atlas-home-company-heading h3 \{[\s\S]*?overflow-wrap: anywhere;/);
  expect(homeCss).toMatch(/\.atlas-home-text-action,[\s\S]*?max-width: 100%;[\s\S]*?white-space: normal;/);
 });
});
