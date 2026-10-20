import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import CompanyResearchPrototype from './CompanyResearchPrototype';

describe('isolated Obsidian Glass Company Research study',()=>{
  const markup=renderToStaticMarkup(createElement(CompanyResearchPrototype));

  it('visibly identifies fictional content and balanced cases',()=>{
    expect(markup).toContain('DESIGN STUDY / NOT LIVE RESEARCH');
    expect(markup).toContain('FICTIONAL DESIGN EXAMPLE');
    expect(markup).toContain('BULL CASE · ILLUSTRATIVE HYPOTHESIS');
    expect(markup).toContain('BEAR CASE · ILLUSTRATIVE HYPOTHESIS');
    expect(markup).toContain('No buy rating, price target, or verified conviction');
  });

  it('shows periods and sources without passing invented values off as SEC facts',()=>{
    expect(markup).toContain('FY 2025 · USD');
    expect(markup).toContain('Illustrative filing fixture · line 01');
    expect(markup).toContain('They are not SEC facts');
    expect(markup).toContain('Capital expenditure');
    expect(markup).toContain('Unavailable');
    expect(markup).toContain('A missing value is not zero; no FCF or FCF margin is shown.');
  });

  it('exposes macro and history limitations without claiming live automation',()=>{
    expect(markup).toContain('CPI');
    expect(markup).toContain('FOMC');
    expect(markup).toContain('Employment');
    expect(markup).toContain('Unassessed');
    expect(markup).toContain('does not read or write saved research');
    expect(markup).toContain('No background monitoring, automatic reassessment');
  });

  it('provides honest empty company and no-history states',()=>{
    const empty=renderToStaticMarkup(createElement(CompanyResearchPrototype,{initialView:'empty'}));
    const noHistory=renderToStaticMarkup(createElement(CompanyResearchPrototype,{initialHistoryView:'none'}));
    expect(empty).toContain('No company has been selected');
    expect(empty).not.toContain('Meridian Fieldworks');
    expect(noHistory).toContain('No prior assessment is available.');
    expect(noHistory).not.toContain('Investor revised the uncertainty');
  });

  it('uses internal study navigation and clearly links back to production',()=>{
    expect(markup).toContain('href="#crp-cases"');
    expect(markup).toContain('href="#crp-evidence"');
    expect(markup).toContain('href="#crp-continuity"');
    expect(markup).toContain('aria-label="Return to production ATLAS Home"');
  });
});
