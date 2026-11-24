import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const dashboard = read("../app/dashboard.tsx");
const home = read("../components/HomeCourtside.tsx");
const press = read("../components/PressableScale.tsx");
const explore = read("../components/ExploreLinks.tsx");

test("Build 11 GlassHeader is safe-area pinned, glass-backed and worklet-collapsible on Home", () => {
  const header = read("../components/glass/GlassHeader.tsx");
  assert.match(dashboard, /edges=\{\["left", "right", "bottom"\]\}/);
  assert.match(dashboard, /<GlassBackdrop screen="home" \/>/);
  const pinned = dashboard.indexOf("<GlassHeader homeScrollY={scrollY} />");
  const scroll = dashboard.indexOf('testID="dashboard-scroll"');
  assert.ok(pinned >= 0 && scroll > pinned, "Home glass header precedes the scroll content");
  assert.match(dashboard, /useAnimatedScrollHandler/);
  assert.match(dashboard, /paddingTop: insets.top \+ 94/);
  assert.match(header, /homeScrollY\?\.get\(\)/);
  assert.match(header, /interpolate\(offset, \[0, 100\], \[46, 40\]/);
  assert.match(header, /<GlassSurface navigation native intensity=\{55\}/);
  assert.match(header, /<BrandLogo \/>/);
  assert.match(header, /accessibilityLabel="Alerts"/);
  assert.match(header, /accessibilityElementsHidden/);
  assert.doesNotMatch(dashboard, /#111E34/, "The obsolete flat header must not replace the glass design");
});

test("Home section entrance is one-shot, staggered, and motion-accessible", () => {
  assert.match(home, /export function HomeStagger/);
  assert.match(home, /useRef\(false\)/);
  assert.match(home, /started\.current = true/);
  assert.match(home, /withDelay\(index \* 80/);
  assert.match(home, /duration: 350/);
  assert.match(home, /translateY: \(1 - progress\.get\(\)\) \* 12/);
  assert.match(home, /ReduceMotion\.System/);
});

test("Home skeleton crossfade keeps reserved section space and does not flash on refresh", () => {
  assert.match(home, /function HomeCrossfade/);
  assert.match(home, /duration: 250/);
  assert.match(home, /\{ minHeight \}/);
  assert.match(home, /pointerEvents=\{loading \? "none" : "auto"\}/);
  assert.match(home, /accessibilityElementsHidden=\{loading\}/);
  assert.match(home, /Loading followed teams/);
  assert.equal((home.match(/title="My Teams"/g) || []).length, 1);
  assert.equal((home.match(/<HomeCrossfade loading=\{!data\}/g) || []).length, 3,
    "Consolidated My Teams, Live & Upcoming, HoopFeed each crossfade once");
  assert.doesNotMatch(home, /setSnapshot\(null\)/);
  assert.match(home, /snapshot\?\.scope===scope/);
});

test("Home preview filtering and membership gating stay unchanged", () => {
  assert.match(home, /selectHomePreviewGames\(data\?\.games\?\.games\?\?\[\]\)/);
  assert.match(home, /title="LIVE & UPCOMING"/);
  assert.match(home, /!gameAccess\?<Text/);
  assert.match(home, /!feedAccess\?<Text/);
  assert.match(home, /No community posts yet\. Start a discussion in HoopFeed/);
});

test("Home presses spring to 0.97 but haptic occurs only on completed taps", () => {
  assert.match(press, /withSpring\(0\.97/);
  assert.match(press, /damping: 15/);
  assert.match(press, /stiffness: 300/);
  assert.match(press, /unstable_pressDelay = 160/);
  assert.match(press, /reduceMotion: reduced \? ReduceMotion\.Always : ReduceMotion\.System/);
  const completedTap = press.indexOf("onPress={event =>");
  const haptic = press.indexOf("Haptics.impactAsync");
  const pressIn = press.indexOf("onPressIn={event =>");
  assert.ok(completedTap >= 0 && completedTap < haptic && haptic < pressIn,
    "Haptic must be in onPress, not in onPressIn");
  assert.match(explore, /const ItemPressable = compact \? PressableScale : Pressable/);
  assert.match(dashboard, /<ExploreLinks compact \/>/);
});
