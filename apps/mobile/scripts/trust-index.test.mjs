import test from "node:test";
import assert from "node:assert/strict";
import { readTrustIndex, parseTrustIndex } from "../src/native/trustIndex.ts";
const id = "12345678-1234-4123-8123-123456789abc";
const valid = { tier: "premium", score: 73, reviewCount: 6, verifiedReviewCount: 4 };
const payload = row => ({ scores: { [id]: row } });
test("locked result never exposes protected counts or score", () => {
  assert.deepEqual(parseTrustIndex(payload({ ...valid, locked: true }), id), { status: "locked" });
});
test("server score is used without recalculation; null does not become zero", () => {
  assert.deepEqual(parseTrustIndex(payload(valid), id), { status: "available", score: 73, reviews: 6, verified: 4 });
  assert.deepEqual(parseTrustIndex(payload({ ...valid, score: null, reviewCount: 0, verifiedReviewCount: 0 }), id),
    { status: "available", score: null, reviews: 0, verified: 0 });
});
test("malformed and mismatched results fail closed", () => {
  for (const row of [{ ...valid, score: 101 }, { ...valid, verifiedReviewCount: 7 }, { ...valid, score: 5, reviewCount: 0, verifiedReviewCount: 0 }, { ...valid, locked: "false" }, { ...valid, reviewCount: "6" }]) {
    assert.throws(() => parseTrustIndex(payload(row), id));
  }
  assert.throws(() => parseTrustIndex({ scores: {} }, id));
});
test("read uses HTTPS, exact bearer, requested entity, batch no-store and no redirects", async () => {
  const controller = new AbortController();
  const request = async (url, opts) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/api/trust-score");
    assert.equal(parsed.searchParams.get("entityType"), "womens-team");
    assert.equal(parsed.searchParams.get("entityIds"), id);
    assert.equal(parsed.searchParams.has("entityId"), false);
    assert.equal(opts.headers.Authorization, "Bearer test-token");
    assert.equal(opts.cache, "no-store");
    assert.equal(opts.redirect, "error");
    assert.equal(opts.signal, controller.signal);
    return new Response(JSON.stringify(payload(valid)), { status: 200 });
  };
  assert.equal((await readTrustIndex("https://hoopcheck.online", "test-token", "womens-team", id, controller.signal, request)).status, "available");
});
test("invalid origin, id, missing bearer and server errors never reveal data", async () => {
  const never = async () => { throw new Error("Unexpected network request"); };
  for (const origin of ["http://hoopcheck.online", "https://user:pass@hoopcheck.online", "https://hoopcheck.online/path"]) {
    await assert.rejects(readTrustIndex(origin, "test-token", "team", id, undefined, never), /Invalid Trust Index request/);
  }
  await assert.rejects(readTrustIndex("https://hoopcheck.online", "", "team", id, undefined, never), /Invalid Trust Index request/);
  await assert.rejects(readTrustIndex("https://hoopcheck.online", "token", "team", "bad", undefined, never), /Invalid Trust Index request/);
  await assert.rejects(readTrustIndex("https://hoopcheck.online", "token", "team", id, undefined, async () => new Response("", { status: 403 })), /unavailable/);
});
