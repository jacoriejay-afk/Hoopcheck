import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GAME_PAST_WINDOW_MS, GAME_FUTURE_WINDOW_MS, gameDisplayState, lastCheckedLabel, providerReceiptLabel } from "../src/native/gameFreshness.ts";
import { selectHomePreviewGames } from "../src/native/homeGamePreview.ts";

const now = Date.parse("2026-11-24T08:00:00Z");
const game = (status, scheduled_at, overrides = {}) => ({
  id: "11111111-1111-4111-8111-000000000001",
  status, scheduled_at, started_at: null, period_label: null, score_updated_at: new Date(now-5*60_000).toISOString(), ...overrides,
});

test("a completed game is FINAL and never inherits an old Q1 label", () => {
  for (const status of ["finished", "final"]) {
    const result = gameDisplayState(game(status, "2026-11-23T18:00:00Z", { period_label: "Q1" }), now, now);
    assert.equal(result.kind, "final");
    assert.equal(result.isLive, false);
    assert.equal(result.label, "FINAL");
  }
});

test("only plausible, freshly checked provider-live fixtures show LIVE", () => {
  const recent = game("live", "2026-11-24T06:00:00Z");
  assert.deepEqual(gameDisplayState(recent, now, now), {
    kind: "live", label: "● LIVE", isLive: true, needsVerification: false,
  });
  for (const stale of [
    game("live", "2026-11-23T06:00:00Z"),
    game("live", "2026-11-25T19:00:00Z"),
    game("live", null),
  ]) {
    const display = gameDisplayState(stale, now, now);
    assert.equal(display.kind, "awaiting");
    assert.equal(display.isLive, false);
    assert.equal(display.needsVerification, true);
  }
  assert.equal(gameDisplayState(recent, now, now - 121_000).isLive, false);
  assert.equal(gameDisplayState(recent, now, now + 120_000).isLive, false);
  assert.equal(gameDisplayState(recent, now, null).isLive, true, "Home may not have a DB check timestamp");
});

test("scheduled results that already passed tip-off cannot be presented as upcoming", () => {
  assert.equal(gameDisplayState(game("scheduled","2026-11-24T06:30:00Z"),now,now).kind,"awaiting");
  assert.equal(gameDisplayState(game("scheduled","2026-11-24T08:05:00Z"),now,now).kind,"upcoming");
  assert.equal(gameDisplayState(game("scheduled",null),now,now).kind,"unverified");
  assert.equal(gameDisplayState(game("postponed","2026-11-24T07:00:00Z"),now,now).label,"POSTPONED");
  assert.equal(gameDisplayState(game("abandoned","2026-11-24T07:00:00Z"),now,now).kind,"cancelled");
  assert.equal(gameDisplayState(game("suspended","2026-11-24T07:00:00Z"),now,now).kind,"unverified");
});

test("Home highlights only credible live and future fixtures", () => {
  const games = [
    game("live", "2026-11-23T07:00:00Z", { id: "old-live" }),
    game("live", "2026-11-24T07:00:00Z", { id: "fresh-live" }),
    game("scheduled", "2026-11-24T07:00:00Z", { id: "late-scheduled" }),
    game("scheduled", "2026-11-24T08:30:00Z", { id: "soon" }),
    game("final", "2026-11-23T18:00:00Z", { id: "final" }),
  ];
  assert.deepEqual(selectHomePreviewGames(games, now).map(item => item.id), ["fresh-live", "soon"]);
});

test("the poll disclosure never confuses a DB check with a provider update", () => {
  assert.equal(lastCheckedLabel(now, now), "Checked just now");
  assert.equal(lastCheckedLabel(now - 61_000, now), "Checked 1 min ago");
  assert.equal(lastCheckedLabel(now - 61 * 60_000, now), "Checked 1 hr ago");
  assert.equal(lastCheckedLabel(NaN, now), "Check time unavailable");
  assert.equal(GAME_PAST_WINDOW_MS, 36 * 3600_000);
  assert.equal(GAME_FUTURE_WINDOW_MS, 14 * 86400_000);
});

test("Game Center keeps its last verified user-scoped snapshot during network failures", () => {
  const src = readFileSync(new URL("../app/fan-live.tsx", import.meta.url), "utf8");
  const scoreboard = readFileSync(new URL("../components/Scoreboard.tsx", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../src/native/liveGames.ts", import.meta.url), "utf8");
  assert.match(src, /lastCheckedLabel\(checkedAtMs!, clockMs\)/);
  assert.match(src, /Provider scores may lag/);
  assert.match(src, /setSnapshot\(current => current\?\.scope === scope \? current : null\)/);
  assert.match(src, /setLoading\(!hasSnapshot\)/);
  assert.match(src, /HoopCheckLoading/);
  assert.match(src, /canUseLiveGameHub \? "hub" : "predictions"/);
  assert.match(scoreboard, /state\.needsVerification/);
  assert.match(scoreboard, /live && game\.period_label/);
  assert.match(loader, /\.lte\("scheduled_at", until\)/);
  assert.match(loader, /const visible = games\.filter/);
});

test("free-player predictions API uses the same bounded period before LIMIT", () => {
  const source = readFileSync(new URL("../../../app/api/game-predictions/route.ts", import.meta.url), "utf8");
  const modeSection = source.split('url.searchParams.get("mode") === "games"')[1]?.split('url.searchParams.get("mode") === "leaderboard"')[0] || "";
  assert.ok(modeSection, "Find free-player games mode");
  assert.match(modeSection, /const since = new Date\(now - 36 \* 60 \* 60_000\)/);
  assert.match(modeSection, /const until = new Date\(now \+ 14 \* 24 \* 60 \* 60_000\)/);
  assert.match(modeSection, /\.gte\("scheduled_at", since\)\.lte\("scheduled_at", until\)/);
  assert.match(modeSection, /\.limit\(500\)/);
  assert.ok(modeSection.indexOf('.gte("scheduled_at", since)') < modeSection.indexOf(".limit(500)"));
  assert.match(source, /currentUser\(request, auth\)/, "Keep authenticated user gate");
  assert.match(source, /Cache-Control": "private, no-store"/, "Never cache per-user predictions in a public CDN");
});

test("fresh database polls cannot turn missing or expired provider receipts into LIVE", () => {
  for (const value of [undefined,null,"invalid",new Date(now-31*60_000).toISOString(),new Date(now+120_000).toISOString()]) {
    assert.equal(gameDisplayState(game("live","2026-11-24T06:00:00Z",{score_updated_at:value}),now,now).isLive,false);
  }
  assert.equal(providerReceiptLabel(null,now),"Provider refresh not verified");
  assert.equal(providerReceiptLabel(new Date(now-5*60_000).toISOString(),now),"Provider checked 5 min ago");
});
