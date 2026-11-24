import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const feed = readFileSync(new URL("../app/feed.tsx", import.meta.url), "utf8");
const fixture = readFileSync(new URL("./verify-feed-browser.cjs", import.meta.url), "utf8");
const account = readFileSync(new URL("../src/native/accountClient.ts", import.meta.url), "utf8");

test("Posts/Reels tab remounts FlatList when viewability config changes", () => {
  // React Native VirtualizedList does not support replacing its viewability
  // config or onViewableItemsChanged callback on an already mounted instance.
  assert.match(feed, /<FlatList key=\{reels \? "reels:" \+ watchMode : "posts"\}/);
  assert.match(feed, /itemVisiblePercentThreshold: reels \? 75 : 30/);
  assert.match(feed, /const nextIds = reels \? candidates\.slice\(0, 1\) : candidates/);
  assert.match(feed, /enabled=\{focused && visible\.has\(post\.id\)\}/);
});

test("Reels retain owner-scoped blocklist, moderation, and fail-closed bootstrap fixture", () => {
  assert.match(feed, /blockedCreators\.owner === uid && blockedCreators\.ready && !blockedCreators\.failed/);
  assert.match(feed, /supabase\.from\("user_blocks"\)\.select\("blocked_id"\)\.eq\("blocker_id", uid\)/);
  assert.match(feed, /!blockedCreators\.ids\.includes\(post\.author_id\)/);
  assert.match(fixture, /canUseLiveGameChat:allowed,canSwitchBasketballSide:allowed/);
  for (const field of ["canReadHoopFeed", "canWriteHoopFeed", "canUseLiveGameChat", "canSwitchBasketballSide"]) {
    assert.ok(account.includes('"' + field + '"'), "Real account parser must require " + field);
  }
});
