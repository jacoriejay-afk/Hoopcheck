import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const feed = read("../app/feed.tsx");
const header = read("../components/glass/GlassHeader.tsx");
const check = read("../components/FeedCheckAction.tsx");
const media = read("../components/FeedMedia.tsx");

test("HoopFeed uses one safe-area glass island with two branded tabs and no bot", () => {
  assert.match(feed, /<GlassHeader feedMode feedReels=\{reels\}/);
  assert.match(header, /testID="feed-compact-header"/);
  assert.match(header, /paddingTop: insets\.top \+ 4/);
  assert.match(header, /<GlassSurface navigation native intensity=\{52\}/);
  assert.match(header, /accessibilityRole="tablist"/);
  assert.match(header, /accessibilityLabel=\{value \? "Reels" : "HoopFeed"\}/);
  assert.doesNotMatch(header, /Meet HoopBot/);
  assert.doesNotMatch(feed, /Recent posts from hoopers/);
  assert.doesNotMatch(feed, /Meet HoopBot · Welcome guide/);
  assert.doesNotMatch(feed, /fontSize: 28 }}>HOOPFEED/);
  assert.match(feed, /reels && posts.length > 0 \? \["top", "left", "right", "bottom"\] : \["left", "right", "bottom"\]/);
});

test("feed rows reduce spacing without changing 44pt targets or API gates", () => {
  assert.match(feed, /paddingHorizontal: reels \? 0 : 8/);
  assert.match(feed, /gap: reels \? 0 : 6/);
  assert.match(feed, /height: 48, width: 48/);
  assert.match(feed, /posts\.length > 0 \? <ScrollView/);
  assert.match(feed, /<GlassCard testID=/);
  assert.match(feed, /solid radius=\{glass\.radii\.row\} padding=\{9\}/);
  assert.match(feed, /FeedCheckAction compact/);
  assert.match(feed, /accessibilityLabel="Comments"/);
  assert.match(feed, /accessibilityLabel="Share"/);
  assert.match(feed, /accessibilityLabel=\{saved\[post\.id\] \? "Saved" : "Save"\}/);
  assert.match(feed, /minHeight: 44, paddingHorizontal: 4/);
  assert.match(check, /minHeight: 44/);
  assert.match(media, /maxImageHeight/);
  assert.match(feed, /maxImageHeight=\{300\}/);
  assert.match(feed, /features\.canReadHoopFeed/);
  assert.match(feed, /features\.canWriteHoopFeed/);
  assert.match(feed, /moderateFeedText/);
  assert.match(feed, /FeedPoll/);
  assert.match(feed, /loadComments/);
  assert.match(feed, /feedAction/);
});