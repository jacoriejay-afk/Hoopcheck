import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("native Liquid Glass requires runtime capability and respects Reduce Transparency", () => {
  const glass = read("../components/GlassSurface.tsx");
  const tabs = read("../components/TabBar.tsx");
  for (const src of [glass, tabs]) {
    assert.match(src, /isGlassEffectAPIAvailable\(\)/);
    assert.match(src, /isLiquidGlassAvailable\(\)/);
    assert.match(src, /isReduceTransparencyEnabled\(\)/);
    assert.match(src, /BlurView/);
  }
  assert.match(glass, /const opaque = solid \|\| reduceTransparency/);
  assert.match(tabs, /if \(keyboardVisible\) return null/);
  assert.match(tabs, /accessibilityRole="tablist"/);
  assert.match(tabs, /testID=\{/);
});

test("court design does not bypass privacy or membership gates", () => {
  const home = read("../components/HomeCourtside.tsx");
  const feed = read("../app/feed.tsx");
  const live = read("../app/fan-live.tsx");
  const groups = read("../app/team-hub/groups/index.tsx");
  const player = read("../app/players/[id].tsx");
  assert.match(home, /canReadHoopFeed/);
  assert.match(home, /canUseLiveGameHub/);
  assert.match(feed, /canWriteHoopFeed/);
  assert.match(feed, /canReadHoopFeed/);
  assert.match(live, /canUseLiveGameChat/);
  assert.match(groups, /readClubGroups/);
  assert.match(player, /readPlayerProfile/);
  assert.match(player, /player\.player_verified/);
  assert.match(player, /PlayerPassport/);
  assert.match(player, /Verified professional player/);
});

test("all five requested screens use the shared design language", () => {
  const banner = read("../components/CourtsideBanner.tsx");
  const home = read("../components/HomeCourtside.tsx");
  const feed = read("../app/feed.tsx");
  const live = read("../app/fan-live.tsx");
  const groups = read("../app/team-hub/groups/index.tsx");
  const player = read("../app/players/[id].tsx");
  for (const src of [home, feed, live, groups]) assert.match(src, /CourtsideBanner/);
  assert.match(banner, /HOOPCHECK/);
  assert.match(banner, /HoopCheckDisplay/);
  assert.match(player, /LinearGradient/);
  assert.match(player, /ProfileAvatar/);
});
