import {describe,expect,it} from 'vitest';
import {headlineReferencesIssuer,issuerSearchName} from './issuer-news-identity';
describe('Public news issuer identity is not inferred from ticker collisions',()=>{
 it('rejects an American Airlines article for Alcoa (AA) while allowing Alcoa reporting',()=>{
  expect(issuerSearchName('Alcoa Corp')).toBe('alcoa');
  expect(headlineReferencesIssuer('American Airlines grows Venezuela network with service to Barcelona','Alcoa Corp')).toBe(false);
  expect(headlineReferencesIssuer('What Alcoa (AA) Earnings Beat Means for Shareholders','Alcoa Corp')).toBe(true);
  expect(headlineReferencesIssuer('Alcoa (NYSE:AA) reports Q3 EPS and cautious outlook','Alcoa Corp')).toBe(true);
  expect(headlineReferencesIssuer('AA stock rebounds despite unrelated industry data','Alcoa Corp')).toBe(false);
 });
 it('matches known issuer names rather than speculative ticker-only mentions',()=>{
  expect(headlineReferencesIssuer('AbbVie rises on new SKYRIZI trial results','AbbVie Inc.')).toBe(true);
  expect(headlineReferencesIssuer('Albertsons slips after new analyst warning','Albertsons Companies, Inc.')).toBe(true);
  expect(headlineReferencesIssuer('American Express results top guidance','American Airlines Group Inc.')).toBe(false);
  expect(headlineReferencesIssuer('American Airlines announces airport expansion','American Airlines Group Inc.')).toBe(true);
  expect(headlineReferencesIssuer('Bank of America warns of recession','Bank of America Corp.')).toBe(true);
  expect(headlineReferencesIssuer('Alcoa bond markets rally','Alcoa Corp')).toBe(true);
 });
 it('requires a substantive name and whole-token matching, not a ticker prefix',()=>{
  expect(issuerSearchName('AA Corp.')).toBeNull();
  expect(headlineReferencesIssuer('AA Company results','AA Corp')).toBe(false);
  expect(headlineReferencesIssuer('Alcoaa announces results','Alcoa Corp')).toBe(false);
  expect(headlineReferencesIssuer('An article unrelated to ABBV','AbbVie Inc')).toBe(false);
  expect(issuerSearchName('Albertsons Companies, Inc.')).toBe('albertsons');
 });
});
