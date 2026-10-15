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
 it('filters unrelated publication titles',()=>{const records={message:{items:[{DOI:'10.1/a',title:['Photonic computing research'],published:{'date-parts':[[2026,5,1]]}},{DOI:'10.1/b',title:['Unrelated computing study'],published:{'date-parts':[[2026,5,1]]}}]}};expect(normalizePublications(records,'photonic computing').map((x:{doi:string})=>x.doi)).toEqual(['10.1/a'])});
 it('excludes publication dates after the retrieval date',()=>{const records={message:{items:[{DOI:'10.1/future',title:['Photonic computing in the future'],published:{'date-parts':[[2028,1,1]]}},{DOI:'10.1/past',title:['Photonic computing today'],published:{'date-parts':[[2026,1,1]]}}]}};expect(normalizePublications(records,'photonic computing','2026-10-14').map((x:{doi:string})=>x.doi)).toEqual(['10.1/past'])});
});
