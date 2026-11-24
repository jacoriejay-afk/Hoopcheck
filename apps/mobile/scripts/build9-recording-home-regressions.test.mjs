import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { selectHomePreviewGames } from "../src/native/homeGamePreview.ts";

const dash = readFileSync(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../components/HomeCourtside.tsx", import.meta.url), "utf8");
const explore = readFileSync(new URL("../components/ExploreLinks.tsx", import.meta.url), "utf8");
const now = Date.parse("2026-11-23T18:30:00Z");
const fixture = (id, status, scheduled_at) => ({ id, status, scheduled_at, score_updated_at: new Date(now-5*60_000).toISOString() });

test("Home header stays pinned below iPhone's top safe area", () => {
  assert.match(dash, /edges=\{\["top", "left", "right", "bottom"\]\}/);
  const pinned = dash.indexOf('<View pointerEvents="box-none" style={[styles.pinnedHeader,');
  const scroll = dash.indexOf('testID="dashboard-scroll"');
  const brand = dash.indexOf("<BrandLogo onHero={theme.dark} />", pinned);
  const menu = dash.indexOf('accessibilityLabel="Open account menu"', pinned);
  assert.ok(pinned > 0 && brand > pinned && menu > pinned && brand < scroll && menu < scroll,
    "Header and account menu must overlay rather than move with scrolling content");
  assert.ok(scroll > pinned && dash.includes("pinnedHeader:"), "The pinned header requires layout styles");
});

test("Home shows followed teams once, labels loading, and does not lose account scope checks", () => {
  assert.equal((home.match(/title="My Teams"/g) || []).length, 1);
  assert.doesNotMatch(home, /title="TEAMS YOU FOLLOW"/);
  assert.doesNotMatch(home, /accessibilityLabel="Find more teams"/);
  assert.match(home, /HoopCheckLoading compact label="Loading your teams/);
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
  assert.match(home, /selectHomePreviewGames\(data\?\.games\?\.games\?\?\[\], clockMs\)/);
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


test("Home expires live provider receipts even without a new request, using the same clock for preview and score", () => {
  const live = fixture("expires", "live", "2026-11-23T17:00:00Z");
  assert.equal(selectHomePreviewGames([live], now).length, 1);
  assert.deepEqual(selectHomePreviewGames([live], now + 26 * 60_000), []);
  assert.match(home, /const active = useActiveScreen\(\)/);
  assert.match(home, /if \(!active\) return;\s*setClockMs\(Date.now\(\)\)/);
  assert.match(home, /setInterval\(\(\) => setClockMs\(Date.now\(\)\), 30_000\)/);
  assert.match(home, /clearInterval\(ticker\)/);
  assert.match(home, /<Scoreboard game=\{game\}[^>]+nowMs=\{clockMs\}/);
  const liveScreen = readFileSync(new URL("../app/fan-live.tsx", import.meta.url), "utf8");
  assert.match(liveScreen, /rows\.filter\(g=>gameDisplayState\(g, clockMs, checkedAtMs\)\.isLive\)/);
});
