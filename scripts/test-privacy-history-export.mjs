import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function compile(path, imports) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = { exports: {} };
  new Function("require", "module", "exports", code)(imports, m, m.exports);
  return m.exports;
}
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const mfa = compile("../lib/auth/mfa-core.ts", () => { throw Error("Unexpected import"); });

function fixture(options = {}) {
  const calls = [];
  const token = "e30." + Buffer.from(JSON.stringify({
    sub: owner, exp: Math.floor(Date.now() / 1000) + 600, aal: options.aal ?? "aal1",
  })).toString("base64url") + ".fixture";
  const user = { id: owner, email_confirmed_at: options.unconfirmed ? null : "2026-11-01",
    is_anonymous: options.anonymous ?? false,
    factors: options.mfa ? [{ id: other, factor_type: "totp", status: "verified" }] : [],
  };
  const row = { id, requester_id: options.rowOwner ?? owner, request_type: "export",
    status: "completed", details: "Synthetic request", created_at: "2026-11-01T00:00:00Z",
    admin_notes: "must not escape", assigned_to: other, unexpected: "must not escape" };
  let sessionChecks = 0;
  const controller = new AbortController();
  if (options.cancelBefore) controller.abort();
  const q = {
    select(columns, opts) { calls.push(["select", columns, opts]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    order(key, opts) { calls.push(["order", key, opts]); return this; },
    limit(n) { calls.push(["limit", n]); return this; },
    async abortSignal(signal) {
      assert.ok(signal instanceof AbortSignal);
      const data = options.rows ?? [row];
      if (options.cancelDuringRead) controller.abort();
      return { data, count: options.count === undefined ? data.length : options.count, error: options.readError ?? null };
    },
  };
  const db = {
    auth: {
      async getUser(t) { assert.equal(t, token); calls.push(["user"]); return { data: { user: options.invalid ? null : user }, error: null }; },
      async getClaims(t) { assert.equal(t, token); return { data: { claims: { sub: options.claimOwner ?? owner, role: options.role ?? "authenticated", ...("clientId" in options ? {client_id:options.clientId} : {}), ...("claimAnonymous" in options ? {is_anonymous:options.claimAnonymous} : {}) } }, error: null }; },
    },
    async rpc(name) {
      assert.equal(name, "confirm_active_account_session");
      sessionChecks++;
      return { data: options.active !== false && !(options.revokedDuringRead && sessionChecks > 1), error: null };
    },
    from(table) { calls.push(["from", table]); assert.equal(table, "privacy_requests"); return q; },
  };
  const { POST } = compile("../app/api/account/privacy-history-export/route.ts", name => {
    if (name === "next/server") return { NextResponse: { json: (data, init) => Response.json(data, init) } };
    if (name === "@supabase/supabase-js") return { createClient: (url, key, config) => {
      assert.equal(url, "https://fixture.invalid"); assert.equal(key, "fixture-public");
      assert.equal(config.global.headers.Authorization, "Bearer " + token);
      assert.equal(config.auth.persistSession, false); return db;
    }};
    if (name.endsWith("/mfa-core")) return mfa;
    throw Error(name);
  });
  return { calls, row, async run(auth = "Bearer " + token, query = "", body = undefined) {
    const keys = ["PRIVACY_HISTORY_EXPORT_ENABLED", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
    const previous = keys.map(k => process.env[k]);
    try {
      process.env[keys[0]] = options.disabled ? "false" : "true";
      process.env[keys[1]] = "https://fixture.invalid";
      process.env[keys[2]] = "fixture-public";
      return await POST(new Request("https://fixture.invalid/api/account/privacy-history-export" + query,
        { method: "POST", headers: { authorization: auth }, body, signal: controller.signal }));
    } finally {
      keys.forEach((k, i) => { if (previous[i] === undefined) delete process.env[k]; else process.env[k] = previous[i]; });
    }
  }};
}
test("default-off and malformed bearer never read account data", async () => {
  const disabled = fixture({ disabled: true });
  assert.equal((await disabled.run()).status, 503);
  assert.deepEqual(disabled.calls, []);
  const f = fixture();
  assert.equal((await f.run("Basic invalid")).status, 401);
  assert.deepEqual(f.calls, []);
});
test("unverified, anonymous, wrong-claim, inactive and insufficient-MFA callers are denied", async () => {
  for (const opts of [{ invalid: true }, { unconfirmed: true }, { anonymous: true }, { claimOwner: other },
    { role: "anon" }, { active: false }, { mfa: true }, {clientId:"oauth-fixture"}, {clientId:null}, {claimAnonymous:true}, {claimAnonymous:"false"}]) {
    const f = fixture(opts);
    assert.equal((await f.run()).status, 403);
    assert.ok(!f.calls.some(c => c[0] === "from"));
  }
});
test("verified owner receives only allowlisted request fields; caller body cannot redirect ownership", async () => {
  const f = fixture({ mfa: true, aal: "aal2" });
  const result = await f.run(undefined, "", JSON.stringify({ owner: other }));
  assert.equal(result.status, 200);
  assert.match(result.headers.get("cache-control"), /no-store/);
  assert.match(result.headers.get("content-disposition"), /attachment/);
  assert.equal(result.headers.get("x-content-type-options"), "nosniff");
  const payload = await result.json();
  assert.equal(payload.scope, "privacy_request_history_only");
  assert.deepEqual(payload.requests, [{ id, request_type: "export", status: "completed",
    details: "Synthetic request", created_at: "2026-11-01T00:00:00Z" }]);
  assert.deepEqual(f.calls.find(c => c[0] === "eq"), ["eq", "requester_id", owner]);
  assert.deepEqual(f.calls.find(c => c[0] === "select"), ["select", "id,requester_id,request_type,status,details,created_at", { count: "exact" }]);
});
test("query targeting, unexpected ownership, truncated results and revoked sessions fail closed", async () => {
  const f = fixture();
  assert.equal((await f.run(undefined, "?owner=" + other)).status, 400);
  assert.deepEqual(f.calls, []);
  for (const [opts, expected] of [[{ rowOwner: other }, 503], [{ count: null }, 503],
    [{ count: 2 }, 503], [{ count: 101 }, 409], [{ revokedDuringRead: true }, 403],
    [{ readError: Error("fixture error") }, 503]]) {
    const result = await fixture(opts).run();
    assert.equal(result.status, expected);
    assert.equal(result.headers.get("content-disposition"), null);
    assert.ok(!("requests" in await result.json()));
  }
});
test("empty confirmed history is an honest empty export", async () => {
  const result = await fixture({ rows: [] }).run();
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).requests, []);
});

test("cancelled history export never releases a download", async () => {
  for (const opts of [{cancelBefore:true},{cancelDuringRead:true}]) {
    const f=fixture(opts), result=await f.run();
    assert.equal(result.status,503);assert.equal(result.headers.get("content-disposition"),null);
    assert.ok(!("requests" in await result.json()));
    if(opts.cancelBefore)assert.deepEqual(f.calls,[]);
  }
});
