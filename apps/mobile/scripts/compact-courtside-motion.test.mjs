import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("compact V3 removes oversized editorial captions without dropping data features", () => {
  const banner = read("../components/CourtsideBanner.tsx");
  const home = read("../components/HomeCourtside.tsx");
  const player = read("../app/players/[id].tsx");
  const feed = read("../app/feed.tsx");
  const live = read("../app/fan-live.tsx");
  const groups = read("../app/team-hub/groups/index.tsx");
  assert.doesNotMatch(banner, /THE GAME IS YOURS|A basketball story worth following/);
  assert.doesNotMatch(home, /LIVE & NEXT|YOUR PEOPLE|WATCH & SHARE/);
  assert.doesNotMatch(player, /A basketball story worth following/);
  assert.match(home, /ArenaHeading/);
  assert.match(home, /account\.tier/);
  assert.match(home, /get_public_follow_list/);
  for (const screen of [feed, live, groups]) assert.match(screen, /CourtsideBanner/);
  assert.match(feed, /canReadHoopFeed/);
  assert.match(live, /canUseLiveGameChat/);
  assert.match(groups, /readClubGroups/);
  assert.match(player, /readPlayerProfile/);
});

test("navigation uses reactive animated sport icons with accessible motion fallback", () => {
  const tabs = read("../components/TabBar.tsx");
  const theme = read("../src/theme.ts");
  const motion = read("../src/motion/Provider.tsx");
  assert.match(tabs, /AnimatedTabIcon/);
  assert.match(tabs, /withSequence/);
  assert.match(tabs, /useMotionSetting/);
  assert.match(tabs, /accessibilityRole="tablist"/);
  assert.match(tabs, /accessibilityState=\{\{ selected \}\}/);
  assert.match(motion, /ReducedMotionConfig/);
  assert.match(theme, /AvenirNext-DemiBold/);
  assert.match(theme, /featuredPadding: 12/);
  assert.match(theme, /height: 60/);
});
