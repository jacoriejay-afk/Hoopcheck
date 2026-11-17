import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/api/cron/balldontlie-validation/route.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture({ env = { LIVE_SCORES_CRON_SECRET: "cron-fixture", BALLDONTLIE_API_KEY: "provider-fixture" }, reply = { data: [] }, status = 200, failure } = {}) {
  const calls = [];
  const compiled = { exports: {} };
  const fetch = async (url, options) => {
    calls.push({ url: new URL(url), options });
    if (failure) throw failure;
    return new Response(JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
  };
  new Function("require", "exports", "module", "process", "fetch", js)(require, compiled.exports, compiled, { env }, fetch);
  const request = (authorization = "Bearer cron-fixture") => new Request("https://app.invalid/api/cron/balldontlie-validation", { headers: authorization ? { authorization } : {} });
  return { GET: compiled.exports.GET, calls, request };
}

test("missing configuration or invalid authorization rejects before contacting the provider", async () => {
  for (const authorization of [null, "Bearer wrong", "cron-fixture"]) {
    const f = fixture();
    const response = await f.GET(f.request(authorization));
    assert.equal(response.status, 401);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture({ env: { BALLDONTLIE_API_KEY: "provider-fixture" } });
  assert.equal((await f.GET(f.request())).status, 401);
  assert.equal(f.calls.length, 0);
});

test("an authorized call without a provider key fails closed without an outbound request", async () => {
  const f = fixture({ env: { LIVE_SCORES_CRON_SECRET: "cron-fixture" } });
  assert.equal((await f.GET(f.request())).status, 503);
  assert.equal(f.calls.length, 0);
});

test("one bounded read-only request returns only aggregate statuses and bypasses caching", async () => {
  const f = fixture({ reply: { data: [
    { id: "private-game-id", status: "Final", home_team: { secret: "provider-payload" } },
    { status: "7:00 PM ET" }, { status: "Final", postponed: true },
  ], meta: { next_cursor: "do-not-follow" } } });
  const response = await f.GET(f.request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true, provider: "balldontlie-nba", date: new Date().toISOString().slice(0, 10), games: 3, statuses: { Final: 1, "7:00 PM ET": 1, Postponed: 1 }, persisted: false });
  assert.equal(f.calls.length, 1);
  const { url, options } = f.calls[0];
  assert.equal(url.origin, "https://api.balldontlie.io");
  assert.equal(url.pathname, "/v1/games");
  assert.equal(url.searchParams.getAll("dates[]").length, 1);
  assert.ok(Number(url.searchParams.get("per_page")) <= 100);
  assert.equal(options.method ?? "GET", "GET");
  assert.equal(options.headers.Authorization, "provider-fixture");
  assert.equal(options.cache, "no-store");
  assert.ok(options.signal instanceof AbortSignal);
});

test("an empty game day succeeds without invented fixtures", async () => {
  const f = fixture();
  const response = await f.GET(f.request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.games, 0);
  assert.deepEqual(data.statuses, {});
  assert.equal(data.persisted, false);
});

test("malformed provider responses fail rather than reporting successful validation", async () => {
  for (const reply of [null, {}, { data: {} }, { data: [null] }, { data: [{}] }, { data: [{ status: 123 }] }, { data: [{ status: " " }] }]) {
    const f = fixture({ reply });
    const response = await f.GET(f.request());
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { ok: false, error: "Invalid provider response" });
  }
});

test("provider errors, connection failures and timeouts never expose payloads or credentials", async () => {
  const f = fixture({ status: 429, reply: { message: "private provider error" } });
  const response = await f.GET(f.request());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { ok: false, providerStatus: 429 });
  for (const failure of [new Error("provider-fixture"), new DOMException("private details", "TimeoutError")]) {
    const failed = fixture({ failure });
    const result = await failed.GET(failed.request());
    assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), { ok: false, error: "Provider request failed" });
  }
});
