import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("ordinary post and comment reporting routes to confidential security tickets",()=>{
  const feed=read("../app/feed.tsx"),report=read("../components/FeedReport.tsx");
  assert.match(feed,/<FeedReport key=/);
  assert.match(feed,/commentId=\{comment\.id\}/);
  assert.match(report,/from\("support_tickets"\)\.insert\(\{requester_id:uid/);
  assert.match(report,/category:"security"/);
  assert.match(report,/session\.user\.id!==uid/);
  assert.match(report,/uid===authorId/);
  assert.match(report,/clean\.length<10\|\|clean\.length>500/);
  assert.match(report,/from\("feed_posts"\).*\.eq\("status","approved"\)/);
  assert.match(report,/from\("feed_post_comments"\).*\.eq\("post_id",postId\)/);
  assert.match(report,/locked\.current\|\|sent/);
});
test("blocked comment authors and blocked reply targets are not rendered",()=>{
  const src=read("../app/feed.tsx");
  assert.match(src,/rawPage\.rows\.filter\(comment=>!blockedCreators\.ids\.includes\(comment\.author_id\)\)/);
  assert.match(src,/page\?\.rows\.some\(comment=>comment\.id===reply\.id\)/);
});
