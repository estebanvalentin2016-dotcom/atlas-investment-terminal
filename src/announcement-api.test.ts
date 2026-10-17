import {describe,it,expect} from 'vitest';
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
 it('rejects links that are not to expected aggregation host',()=>{
  const xml='<item><title>Test</title><link>https://malicious.example/page</link></item>';
  expect(parseAnnouncementFeed(xml,'2026-08-26')).toEqual([]);
 });
 it('does not intercept unrelated routes',async()=>expect(await handleAnnouncementRequest({url:'/api/market/event'},{})).toBe(false));
});
