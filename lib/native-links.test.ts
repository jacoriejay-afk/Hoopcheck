import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalHoopCheckUrl,
  getShareableEntityUrl,
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
  assert.equal(canonicalHoopCheckUrl("http://hoopcheck.online/teams/1"), null);
  assert.equal(canonicalHoopCheckUrl("https://evil.example/teams/1"), null);
  assert.equal(canonicalHoopCheckUrl("//evil.example/teams/1"), null);
  assert.equal(canonicalHoopCheckUrl("javascript:alert(1)"), null);
});

test("rejects paths outside the entity allowlist", () => {
  assert.equal(canonicalHoopCheckUrl("/account"), null);
  assert.equal(canonicalHoopCheckUrl("/teams"), null);
  assert.equal(canonicalHoopCheckUrl("/teams/1/extra"), null);
  assert.equal(canonicalHoopCheckUrl("/api/admin"), null);
});

test("normalizes relative links, preserves query, and removes fragments", () => {
  const result = getShareableEntityUrl("/teams/team-123?source=share#details");
  assert.equal(
    result,
    "https://hoopcheck.online/teams/team-123?source=share",
  );
});

test("does not accept a trusted hostname with a different port", () => {
  assert.equal(canonicalHoopCheckUrl("https://hoopcheck.online:444/teams/1"), null);
});
