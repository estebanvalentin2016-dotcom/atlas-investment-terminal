import {afterEach,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import RealWorkspace from './RealWorkspace';
import {latestResearch,readResearchContext,savedDevelopments,saveResearchSummary,SUMMARY_KEY,type ResearchSummary} from './watchlist-research';
import {readWorkspaceStorage,removeSavedCompany,selectComparison,WATCH_KEY,NOTES_KEY} from './watchlist-storage';
const source='https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json';
const summary:ResearchSummary={ticker:'TEST',createdAt:'2026-10-15T12:00:00Z',headline:'Evidence remains incomplete',finding:'Reported annual financials require further research.',source,action:'WATCH',verdict:'INSUFFICIENT EVIDENCE'};
function memory(values:Record<string,string>={}){const data={...values};return {getItem:(key:string)=>data[key]??null,setItem:vi.fn((key:string,value:string)=>{data[key]=value}),data}}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()});
describe('Saved company research without invented live updates',()=>{
 it('chooses the newest dated research, ignoring future snapshots',()=>{
  const newer={...summary,createdAt:'2026-10-16T10:00:00Z',headline:'New research'};
  const future={...summary,createdAt:'2028-01-01',headline:'Future'};
  expect(latestResearch('TEST',[summary,newer,future],[],'2026-10-16T11:00:00Z')?.headline).toBe('New research');
  expect(latestResearch('OTHER',[summary],[])).toBeNull();
 });
 it('retains pre-existing thesis drafts with explicit user-supplied provenance',()=>{
  const thesis={ticker:'TEST',createdAt:'2026-10-16T10:00:00Z',thesis:'Existing saved thesis',invalidation:'Counterevidence',verdict:'INSUFFICIENT EVIDENCE'};
  const result=latestResearch('TEST',[summary],[thesis],'2026-10-16T11:00:00Z');
  expect(result?.text).toBe(thesis.thesis);expect(result?.headline).toContain('not independently verified');expect(result?.source).toBeNull();
 });
 it('only shows recent issuer-matched source filings, never fake news or future events',()=>{
  const filing={ticker:'TEST',name:'Test company',filed:'2026-10-15',form:'8-K',kind:'Unreviewed',url:'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001.txt'};
  const rows=[filing,{...filing,url:'https://news.example.com/article'},{...filing,filed:'2026-11-01'},{...filing,ticker:'OTHER'}];
  expect(savedDevelopments('TEST',rows,'2026-10-16')).toEqual([filing]);
 });
 it('does not admit a lookalike SEC host or corrupt saved source record',()=>{
  const store=memory({[SUMMARY_KEY]:JSON.stringify([summary,{...summary,ticker:'FAKE',source:'https://data.sec.gov.evil.example/api/xbrl/companyfacts/x'}])});
  expect(readResearchContext(store).summaries).toEqual([summary]);
 });
 it('keeps unreadable summary history intact instead of overwriting it',()=>{
  const store=memory({[SUMMARY_KEY]:'not JSON'});
  expect(readResearchContext(store).issues).toHaveLength(1);
  expect(()=>saveResearchSummary(store,summary)).toThrow();expect(store.setItem).not.toHaveBeenCalled();
 });
 it('appends research without changing existing watchlists, notes or theses',()=>{
  const store=memory({[WATCH_KEY]:'[]',[NOTES_KEY]:'{"TEST":"Keep note"}','atlas.conviction.theses.v1':'[]'});
  saveResearchSummary(store,summary);
  expect(JSON.parse(store.data[SUMMARY_KEY])).toEqual([summary]);expect(store.data[NOTES_KEY]).toContain('Keep note');expect(store.setItem).toHaveBeenCalledTimes(1);
 });
 it('renders company identity, historical conclusion, notes and all watchlist actions',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-16T16:00:00Z'));
  const store=memory({[WATCH_KEY]:JSON.stringify([{ticker:'TEST',name:'Test company'}]),[NOTES_KEY]:'{"TEST":"Existing thesis note"}',[SUMMARY_KEY]:JSON.stringify([summary])});vi.stubGlobal('localStorage',store);
  const html=renderToStaticMarkup(createElement(RealWorkspace,{mode:'watchlist',onView:()=>{},onConviction:()=>{}}));
  for(const text of ['Test company','Evidence remains incomplete','Existing thesis note','Research company','Evaluate conviction','Select for comparison','Remove TEST from watchlist','no background monitoring'])expect(html).toContain(text);
  expect(html).not.toContain('Live updates');expect(store.setItem).not.toHaveBeenCalled();
 });
 it('uses honest empty states when no conclusions or source developments were saved',()=>{
  vi.stubGlobal('localStorage',memory({[WATCH_KEY]:'[{"ticker":"TEST","name":"Test company"}]'}));
  const html=renderToStaticMarkup(createElement(RealWorkspace,{mode:'watchlist'}));
  expect(html).toContain('No saved research conclusion');expect(html).toContain('does not establish that no developments occurred');
 });
 it('preserves malformed legacy data and disables writes to affected fields',()=>{
  const store=memory({[WATCH_KEY]:'{"unexpected":true}',[NOTES_KEY]:'not JSON'});const result=readWorkspaceStorage(store);
  expect(result.blocked).toEqual([WATCH_KEY,NOTES_KEY]);expect(result.issues).toHaveLength(2);expect(store.setItem).not.toHaveBeenCalled();
 });
 it('removes only membership, leaving independent notes and research histories intact',()=>{
  const watch=[{ticker:'TEST',name:'Test company'},{ticker:'OTHER',name:'Other company'}];
  const notes={TEST:'Keep this thesis'};expect(removeSavedCompany(watch,'TEST')).toEqual([watch[1]]);expect(notes.TEST).toBe('Keep this thesis');
 });
 it('supports toggling and bounded two-company comparisons',()=>{
  expect(selectComparison(['A'],'B')).toEqual(['A','B']);expect(selectComparison(['A','B'],'A')).toEqual(['B']);expect(selectComparison(['A','B'],'C')).toEqual(['B','C']);
 });
});
