import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import OpportunityIntelligencePrototype from './OpportunityIntelligencePrototype';

describe('Opportunity Intelligence visual prototype', () => {
  const markup = renderToStaticMarkup(createElement(OpportunityIntelligencePrototype));

  it('labels the isolated concept and every result as fictional', () => {
    expect(markup).toContain('Fictional design prototype');
    expect(markup).toContain('Fictional company · illustrative analysis');
    expect(markup).toContain('Design study, not research output.');
  });

  it('centers one priority story without presenting investment advice', () => {
    expect(markup).toContain('Aurum Grid Systems');
    expect(markup).toContain('Priority research');
    expect(markup).toContain('Prior thesis · recorded Sep 24');
    expect(markup).toContain('New catalyst · Oct 17');
    expect(markup).toContain('Outstanding risk');
    expect(markup).toContain('Not an investment recommendation');
  });

  it('explains comparative rejection and qualifies its visualization', () => {
    expect(markup).toContain('Why the alternatives did not rank first');
    expect(markup).toContain('customer concentration');
    expect(markup).toContain('improving cash conversion');
    expect(markup).toContain('leverage and project timing');
    expect(markup).toContain('Illustrative score · not a forecast');
  });
});
