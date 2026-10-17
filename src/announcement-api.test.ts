import {describe,it,expect,vi} from 'vitest';
// @ts-ignore server-only adapter
import {parseAnnouncementFeed,handleAnnouncementRequest} from '../server/announcement-api.mjs';
describe('automated public announcement candidate feed',()=>{
 it('extracts bounded news candidates without claiming verified issuer timestamps',()=>{
  const xml='<rss><channel><item><title>CRWD earnings &amp; outlook</title><link>https://news.google.com/rss/articles/example</link><pubDate>Thu, 27 Aug 2026 12:00:00 GMT</pubDate><source>Example News</source></item></channel></rss>';
  const rows=parseAnnouncementFeed(xml,'2026-08-26');
  expect(rows).toHaveLength(1);
  expect(rows[0].title).toBe('CRWD earnings & outlook');
  expect(rows[0].feedPublishedAt).toBe('2026-08-27T12:00:00.000Z');
 });
 it('never invents 3 AM EDT when an RSS record provides only a calendar date',()=>{
  const xml='<item><title>Example issuer update</title><link>https://news.google.com/rss/articles/dateonly</link><pubDate>Thu, 15 Oct 2026</pubDate></item>';
  const rows=parseAnnouncementFeed(xml,'2026-10-15');
  expect(rows).toHaveLength(1);
  expect(rows[0].feedPublishedAt).toBeNull();
  expect(rows[0].feedDateOnly).toBe('2026-10-15');
  expect(rows[0].feedDateRaw).toBe('Thu, 15 Oct 2026');
 });
 it('preserves full RSS UTC clocks without declaring them verified publisher timestamps',()=>{
  const xml='<item><title>Valid timestamp</title><link>https://news.google.com/rss/articles/time</link><pubDate>Thu, 15 Oct 2026 07:00:00 GMT</pubDate></item>';
  const [row]=parseAnnouncementFeed(xml,'2026-10-15');
  expect(row.feedPublishedAt).toBe('2026-10-15T07:00:00.000Z');
  expect(row.feedTimeSource).toContain('aggregation clock');
 });
 it('rejects links that are not to expected aggregation host',()=>{
  const xml='<item><title>Test</title><link>https://malicious.example/page</link></item>';
  expect(parseAnnouncementFeed(xml,'2026-08-26')).toEqual([]);
 });
 it('searches by issuer identity when supplied instead of ambiguous AA symbol',async()=>{
  const urls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async (raw:URL)=>{urls.push(String(raw));return new Response('<rss><channel></channel></rss>',{status:200})}));
  const code:number[]=[];let value='';
  try{
   await handleAnnouncementRequest({method:'GET',url:'/api/catalyst/announcements?ticker=AA&date=2026-10-15&company=alcoa'},{
    writeHead(status:number){code.push(status)},
    end(body:string){value=body}
   });
   expect(code).toContain(200);
   const query=new URL(urls[0]).searchParams.get('q')??'';
   expect(query).toContain('"alcoa"');
   expect(query).not.toContain('"AA"');
   expect(JSON.parse(value).verifiedOriginalPublicationTimes).toBe(false);
  }finally{vi.unstubAllGlobals()}
 });
 it('rejects issuer identity query injection without fetching upstream',async()=>{
  const statuses:number[]=[];
  await handleAnnouncementRequest({method:'GET',url:'/api/catalyst/announcements?ticker=AA&date=2026-10-15&company='+encodeURIComponent('alcoa" OR "apple')},{
   writeHead(code:number){statuses.push(code)},
   end(_body:string){}
  });
  expect(statuses).toEqual([400]);
 });
 it('does not intercept unrelated routes',async()=>expect(await handleAnnouncementRequest({url:'/api/market/event'},{})).toBe(false));
});
