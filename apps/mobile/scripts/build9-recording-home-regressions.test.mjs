import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { selectHomePreviewGames } from "../src/native/homeGamePreview.ts";

const dash = readFileSync(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../components/HomeCourtside.tsx", import.meta.url), "utf8");
const explore = readFileSync(new URL("../components/ExploreLinks.tsx", import.meta.url), "utf8");
const now = Date.parse("2026-11-23T18:30:00Z");
const fixture = (id, status, scheduled_at) => ({ id, status, scheduled_at });

test("Home GlassHeader stays pinned and owns the iPhone top safe area once", () => {
  const header = readFileSync(new URL("../components/glass/GlassHeader.tsx", import.meta.url), "utf8");
  assert.match(dash, /edges=\{\["left", "right", "bottom"\]\}/);
  const pinned = dash.indexOf("<GlassHeader homeScrollY={scrollY} />");
  const scroll = dash.indexOf('testID="dashboard-scroll"');
  assert.ok(pinned > 0 && scroll > pinned, "Glass header must remain outside scrolling content");
  assert.doesNotMatch(dash, /pinnedHeader:/);
  assert.match(header, /useSafeAreaInsets/);
  assert.match(dash, /useAnimatedScrollHandler/);
  assert.match(header, /homeScrollY\?\.get\(\)/);
  assert.match(header, /GlassCard radius=\{999\}/);
  assert.match(header, /paddingTop: insets\.top \+ 8/);
  assert.match(header, /<BrandLogo \/>/);
  assert.match(header, /accessibilityLabel="Alerts"/);
});

test("Home shows followed teams once, labels loading, and does not lose account scope checks", () => {
  assert.equal((home.match(/title="My Teams"/g) || []).length, 1);
  assert.doesNotMatch(home, /title="TEAMS YOU FOLLOW"/);
  assert.doesNotMatch(home, /accessibilityLabel="Find more teams"/);
  assert.match(home, /Loading followed teams/);
  assert.match(home, /snapshot\?\.scope===scope/);
  assert.match(home, /visibleConnections\(result\.data, role\)/);
});

test("Home game preview prioritizes live, then next tip-off, excluding old final games", () => {
  const data = [
    fixture("last-week-final", "final", "2026-11-17T04:00:00Z"),
    fixture("today-final", "finished", "2026-11-23T16:00:00Z"),
    fixture("tomorrow", "scheduled", "2026-11-24T19:00:00Z"),
    fixture("soon", "scheduled", "2026-11-23T19:00:00Z"),
    fixture("live", "live", "2026-11-23T17:00:00Z"),
    fixture("stale-live", "live", "2026-11-17T17:00:00Z"),
    fixture("past-scheduled", "scheduled", "2026-11-23T15:00:00Z"),
    fixture("cancelled", "cancelled", "2026-11-23T20:00:00Z"),
  ];
  assert.deepEqual(selectHomePreviewGames(data, now).map(g => g.id), ["live", "soon"]);
  assert.deepEqual(selectHomePreviewGames(data, now, 4).map(g => g.id), ["live", "soon", "tomorrow"]);
  assert.deepEqual(selectHomePreviewGames([data[0], data[1], data[5]], now), []);
  assert.match(home, /selectHomePreviewGames\(data\?\.games\?\.games\?\?\[\]\)/);
  assert.match(home, /title="LIVE & UPCOMING"/);
});

test("Home excludes unknown kickoffs and avoids old score panels when no active games", () => {
  assert.deepEqual(selectHomePreviewGames([
    fixture("missing", "scheduled", null),
    fixture("invalid", "live", "unknown"),
    fixture("future-final", "final", "2026-11-24T18:00:00Z"),
  ], now), []);
  assert.match(home, /No live or upcoming games/);
  assert.match(home, /Scoreboard game=\{game\}/);
});

test("Home directory is compact without changing public directory navigation", () => {
  assert.match(dash, /<ExploreLinks compact \/>/);
  assert.match(explore, /compact = false/);
  assert.match(explore, /flexWrap: "wrap"/);
  assert.match(explore, /width: "48%"/);
  assert.match(explore, /!publicOnly \|\| index < 5/);
  for (const route of ['"/teams"', '"/womens"', '"/coaches"', '"/leagues"', '"/players"']) {
    assert.ok(explore.includes(route), "Kept directory entry: " + route);
  }
});

test("Eligible HoopFeed empty state is actionable and preserves membership gating", () => {
  assert.match(home, /No community posts yet\. Start a discussion in HoopFeed/);
  assert.match(home, /accessibilityLabel="Open HoopFeed to start a discussion"/);
  assert.match(home, /!feedAccess\?<Text/);
  assert.match(home, /onPress=\{\(\)=>router\.push\("\/feed"\)\}/);
});
