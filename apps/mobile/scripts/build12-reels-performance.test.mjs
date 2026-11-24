import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Build 12 keeps Reel pages at measured height for consistent one-swipe paging", () => {
  const feed = read("../app/feed.tsx");
  assert.match(feed, /pagingEnabled=\{reels\}/);
  assert.match(feed, /getItemLayout=\{reels && height > 0 \?/);
  assert.match(feed, /length: height, offset: height \* index, index/);
  assert.match(feed, /windowSize=\{reels \? 3 : 5\}/);
  assert.match(feed, /itemVisiblePercentThreshold: reels \? 75 : 30/);
});

test("Only the next filtered eligible Reel can preauthorize media while playback remains visibility-gated", () => {
  const feed = read("../app/feed.tsx");
  const media = read("../components/FeedMedia.tsx");
  const video = read("../components/FeedVideo.tsx");
  assert.match(feed, /const currentReelIndex = reels \? posts\.findIndex\(post => visible\.has\(post\.id\)\) : -1/);
  assert.match(feed, /const nextReelId = currentReelIndex >= 0 \? posts\[currentReelIndex \+ 1\]\?\.id \?\? null : null/);
  assert.match(feed, /preload=\{reels && focused && post\.id === nextReelId\}/);
  assert.match(feed, /blockedCreators\.owner === uid && blockedCreators\.ready && !blockedCreators\.failed/);
  assert.match(media, /const shouldAuthorize = enabled \|\| \(preload && video\)/);
  assert.match(media, /data\.session\.user\.id !== userId/);
  assert.match(media, /authorizedFeedMedia\(origin, project, data\.session\.access_token, postId, reference, controller\.signal\)/);
  assert.match(media, /<FeedVideo height=\{height\} uri=\{uri\} enabled=\{enabled\}/);
  assert.match(video, /if \(enabled && loop && uri && AppState\.currentState === "active"\) player\.play\(\)/);
  assert.match(video, /else player\.pause\(\)/);
});

test("HoopFeed removes the unnecessary bot strip but preserves posting and Reels safety controls", () => {
  const feed = read("../app/feed.tsx");
  assert.doesNotMatch(feed, /Meet HoopBot/);
  assert.match(feed, /accessibilityLabel="Create HoopFeed post"/);
  assert.match(feed, /Share a basketball update/);
  assert.match(feed, /<MediaPostComposer key=\{uid\}/);
  assert.match(feed, /<FeedPoll/);
  assert.match(feed, /accessibilityLabel="Report this Reel"/);
  assert.match(feed, /accessibilityLabel="Block this HoopCheck account"/);
  assert.match(feed, /features\.canReadHoopFeed/);
  assert.match(feed, /features\.canWriteHoopFeed/);
});
