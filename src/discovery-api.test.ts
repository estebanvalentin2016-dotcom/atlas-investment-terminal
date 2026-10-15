import {describe,it,expect} from 'vitest';
// @ts-ignore Node backend module under test.
import {normalizePublications,handleDiscoveryRequest} from '../server/discovery-api.mjs';
describe('Crossref normalization',()=>{
 it('converts publication metadata to DOI links without fabricating fields',()=>{
  const papers=normalizePublications({message:{items:[{DOI:'10.1234/example',title:['An experimental device'],published:{'date-parts':[[2026,9,3]]},'container-title':['Journal'],type:'journal-article'}]}});
  expect(papers).toHaveLength(1);expect(papers[0].published).toBe('2026-09-03');expect(papers[0].url).toBe('https://doi.org/10.1234/example');
 });
 it('omits records without a DOI or title',()=>expect(normalizePublications({message:{items:[{title:['No DOI']},{DOI:'10.1/x'}]}})).toEqual([]));
 it('throws for malformed provider payload',()=>expect(()=>normalizePublications({message:{items:null}})).toThrow());
 it('does not claim unrelated API paths',async()=>{expect(await handleDiscoveryRequest({url:'/api/sec/company',method:'GET'},{})).toBe(false)});
});
