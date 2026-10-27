import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalHoopCheckUrl,
  getShareableEntityUrl,
  getHoopCheckDeepLinkRoute,
  HOOPCHECK_ORIGIN,
} from "./native-links.ts";

test("accepts canonical entity routes on the production origin", () => {
  for (const path of [
    "/teams/team-123",
    "/players/player-123/",
    "/womens/team-456",
    "/coaches/coach-789",
    "/leagues/league-abc",
  ]) {
    const result = canonicalHoopCheckUrl(path);
    assert.ok(result, `expected allowed path: ${path}`);
    assert.equal(result.origin, HOOPCHECK_ORIGIN);
  }
});

test("rejects non-HTTPS and untrusted origins", () => {
  for (const url of [
    "http://hoopcheck.online/teams/1",
    "https://evil.example/teams/1",
    "//evil.example/teams/1",
    "javascript:alert(1)",
    "https://hoopcheck.online.evil.example/teams/1",
    "https://evil-hoopcheck.online/teams/1",
    "https://hoopcheck.online@evil.example/teams/1",
  ]) {
    assert.equal(canonicalHoopCheckUrl(url), null, `unexpectedly accepted: ${url}`);
  }
});

test("rejects credentials embedded in an otherwise trusted URL", () => {
  assert.equal(canonicalHoopCheckUrl("https://user@hoopcheck.online/teams/1"), null);
  assert.equal(canonicalHoopCheckUrl("https://user:password@hoopcheck.online/teams/1"), null);
});

test("rejects paths outside the entity allowlist", () => {
  for (const path of [
    "/account",
    "/teams",
    "/teams/1/extra",
    "/api/admin",
    "/teams/",
  ]) {
    assert.equal(canonicalHoopCheckUrl(path), null, `unexpectedly accepted: ${path}`);
  }
});

test("rejects encoded separators inside entity IDs", () => {
  assert.equal(canonicalHoopCheckUrl("/teams/team%2Fadmin"), null);
  assert.equal(canonicalHoopCheckUrl("/players/player%5Cprivate"), null);
  assert.equal(canonicalHoopCheckUrl("/teams/team%2fadmin"), null);
});

test("normalizes relative links, preserves query, and removes fragments", () => {
  const result = getShareableEntityUrl("/teams/team-123?source=share#details");
  assert.equal(result, "https://hoopcheck.online/teams/team-123?source=share");
});

test("does not accept a trusted hostname with a different port", () => {
  assert.equal(canonicalHoopCheckUrl("https://hoopcheck.online:444/teams/1"), null);
});

test("maps validated deep links to internal routes without trusting raw URLs", () => {
  assert.equal(
    getHoopCheckDeepLinkRoute("https://hoopcheck.online/teams/team-123?tab=reviews#top"),
    "/teams/team-123?tab=reviews",
  );
  assert.equal(
    getHoopCheckDeepLinkRoute("https://evil.example/teams/team-123"),
    null,
  );
  assert.equal(getHoopCheckDeepLinkRoute("https://hoopcheck.online/account"), null);
  assert.equal(
    getHoopCheckDeepLinkRoute("https://hoopcheck.online:444/teams/team-123"),
    null,
  );
});
