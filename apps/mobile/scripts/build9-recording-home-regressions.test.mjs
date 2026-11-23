import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { selectHomePreviewGames } from "../src/native/homeGamePreview.ts";

const dash = readFileSync(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../components/HomeCourtside.tsx", import.meta.url), "utf8");
const now = Date.parse("2026-11-23T18:30:00Z");
const fixture = (id, status, scheduled_at) => ({ id, status, scheduled_at });

test("Home header stays pinned below iPhone's top safe area", () => {
  assert.match(dash, /edges=\{\["top", "left", "right", "bottom"\]\}/);
  const pinned = dash.indexOf("<View style={styles.pinnedHeader}>");
  const scroll = dash.indexOf('testID="dashboard-scroll"');
  const brand = dash.indexOf("<BrandLogo onHero />", pinned);
  const menu = dash.indexOf('accessibilityLabel="Open account menu"', pinned);
  assert.ok(pinned > 0 && brand > pinned && menu > pinned && brand < scroll && menu < scroll,
    "Header and account menu must remain outside scrolling content");
  assert.ok(scroll > pinned && dash.includes("pinnedHeader:"), "The pinned header requires layout styles");
});

test("Home shows followed teams once, labels loading, and does not lose account scope checks", () => {
  assert.equal((home.match(/title="MY TEAMS"/g) || []).length, 1);
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
