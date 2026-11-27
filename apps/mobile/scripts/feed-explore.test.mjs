import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesFeedExplore, exploreFilters, cleanExploreSearch } from "../src/native/feedExplore.ts";
const post = {body:"Overseas basketball #training",post_kind:"discussion",profiles:{display_name:"Fixture Creator"},image_url:null,image_urls:null,video_url:null};
test("Explore searches loaded text and creator names, not private metadata",()=>{
  assert.deepEqual(exploreFilters,["all","discussion","media","polls"]);
  assert.equal(matchesFeedExplore(post,"all","  BASKETBALL creator  "),true);
  assert.equal(matchesFeedExplore(post,"all","#training"),true);
  assert.equal(matchesFeedExplore({...post,author_id:"private-id",post_location:"private-location"},"all","private"),false);
  assert.equal(matchesFeedExplore(post,"all","missing"),false);
  assert.equal(matchesFeedExplore({...post,body:null,profiles:null},"all",""),true);
});
test("Explore media and poll filters do not invent content",()=>{
  assert.equal(matchesFeedExplore(post,"discussion",""),true);
  assert.equal(matchesFeedExplore(post,"media",""),false);
  assert.equal(matchesFeedExplore({...post,image_urls:["image"]},"media",""),true);
  assert.equal(matchesFeedExplore({...post,video_url:"video"},"discussion",""),false);
  assert.equal(matchesFeedExplore({...post,post_kind:"poll"},"polls",""),true);
  assert.equal(matchesFeedExplore(post,"polls",""),false);
});
test("Explore is downstream of existing account, expiry, block and saved gates",()=>{
  const feed=readFileSync(new URL("../app/feed.tsx",import.meta.url),"utf8");
  assert.match(feed,/const posts = canRead && blocksVerified && rows\.scope === scope \? rows\.posts\.filter/);
  assert.match(feed,/!blockedCreators\.ids\.includes\(post\.author_id\)/);
  assert.match(feed,/const displayPosts = exploring \? posts\.filter/);
  assert.match(feed,/data=\{displayPosts\}/);
  assert.match(feed,/const exploring = !reels && !savedOnly && explore\.owner === uid/);
  assert.match(feed,/\["all","saved","explore"\]/);
  assert.match(feed,/ListHeaderComponent=\{!reels && !savedOnly && !exploring/);
});

test("server Explore sanitizes terms and distinguishes public post text from creator names",()=>{
 assert.equal(cleanExploreSearch("  İstanbul #hoops (a),x.eq.*%_  "),"İstanbul #hoops a x eq");
 assert.equal(cleanExploreSearch("a".repeat(120)).length,100);
 assert.equal(matchesFeedExplore(post,"all","creator","posts"),false);
 assert.equal(matchesFeedExplore(post,"all","creator","creators"),true);
 assert.equal(matchesFeedExplore(post,"all","training","creators"),false);
});
test("server Explore uses the existing RLS-visible projection and fixed session",()=>{
 const source=readFileSync(new URL("../src/native/feedClient.ts",import.meta.url),"utf8");
 const explore=source.slice(source.indexOf("export async function readExploreFeedPage"),source.indexOf("/** Saved library cursor"));
 assert.match(explore,/readablePosts\(client, now,/);
 assert.match(explore,/\.ilike\(target === "creators" \? "profiles.display_name" : "body"/);
 assert.match(explore,/\.eq\("user_id",userId\)/);
 assert.match(explore,/\.eq\("blocker_id",userId\)/);
 assert.match(explore,/current.data.session.access_token !== token/);
 assert.match(explore,/\.setHeader\("Authorization",header\)/);
 assert.doesNotMatch(explore,/service_role|fetch\(/);
 const feed=readFileSync(new URL("../app/feed.tsx",import.meta.url),"utf8");
 assert.match(feed,/exploring \? readExploreFeedPage/);
 assert.match(feed,/JSON.stringify\(\[uid \?\? "",reels,savedOnly,exploring,exploreSearch,exploreFilter,exploreTarget\]\)/);
});
