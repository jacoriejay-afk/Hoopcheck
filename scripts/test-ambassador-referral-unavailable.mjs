import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const route = readFileSync("app/referral/[code]/route.ts", "utf8");
const page = readFileSync("app/signup/page.tsx", "utf8");
const form = readFileSync("app/signup/SignupForm.tsx", "utf8");

test("an unavailable referral is not silently treated as attributed signup", () => {
  assert.match(route, /new URL\("\/signup\?referral=unavailable"/);
  assert.match(route, /if \(error \|\| typeof data !== "string" \|\| !data\.trim\(\)\) return unavailable\(\);/);
  assert.match(route, /response\.cookies\.delete\(referralCookie\)/);
  assert.match(route, /!process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
});

test("success still mints a fresh short-lived secure referral cookie", () => {
  assert.match(route, /response\.cookies\.set\(referralCookie, data/);
  assert.match(route, /maxAge: 30 \* 60, httpOnly: true/);
  assert.match(route, /sameSite: "lax"/);
  assert.match(route, /Cache-Control", "private, no-store"/);
});

test("signup explains a regular signup will not be attributed", () => {
  assert.match(page, /referralUnavailable=\{params\.referral === "unavailable"\}/);
  assert.match(form, /referralUnavailable && <p className="hc-auth-feedback" role="alert">/);
  assert.match(form, /it will not be credited to the ambassador/);
});


// Exercise the actual transpiled route with isolated NextResponse and RPC doubles.
function loadRoute(dbFactory, env = { SUPABASE_SERVICE_ROLE_KEY: "fixture" }) {
  const source = ts.transpileModule(route, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  const fixtureRequire = (name) => {
    if (name === "next/server") return { NextResponse: { redirect(url) {
      const cookies = { setCalls: [], deleteCalls: [], set(...args) { this.setCalls.push(args); }, delete(name) { this.deleteCalls.push(name); } };
      return { url: String(url), headers: new Headers(), cookies };
    } } };
    if (name === "../../../lib/ambassador/server") return { ambassadorDb: dbFactory, referralCookie: "fixture_referral" };
    if (name === "../../../lib/ambassador/identifiers") return { referralCodePattern: /^[A-Z0-9_-]{4,40}$/ };
    throw new Error("Unexpected import: " + name);
  };
  new Function("require", "exports", "process", "console", source)(fixtureRequire, exports, { env }, { error() {} });
  return exports.GET;
}
const visit = (get, headers = {}, code = "TESTCODE") => get({
  url: "https://fixture.invalid/referral/" + code, nextUrl: { protocol: "https:" }, headers: new Headers(headers),
}, { params: Promise.resolve({ code }) });
function unavailableResult(response) {
  assert.equal(response.url, "https://fixture.invalid/signup?referral=unavailable");
  assert.deepEqual(response.cookies.deleteCalls, ["fixture_referral"]);
  assert.equal(response.cookies.setCalls.length, 0);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
}
test("thrown database initialization and RPC errors clear stale attribution", async () => {
  unavailableResult(await visit(loadRoute(() => { throw new Error("fixture initialization failure"); })));
  unavailableResult(await visit(loadRoute(() => ({ rpc: async () => { throw new Error("fixture transport failure"); } }))));
});
test("RPC error, empty token, and invalid campaign fail closed", async () => {
  for (const result of [{ error: { code: "fixture" }, data: "token" }, { data: "" }, { data: "   " }, { data: null }]) {
    unavailableResult(await visit(loadRoute(() => ({ rpc: async () => result }))));
  }
  unavailableResult(await visit(loadRoute(() => { throw new Error("must not call"); }), {}, "?"));
});
test("prefetch preserves cookie and does not open a referral", async () => {
  let calls = 0;
  const get = loadRoute(() => { calls++; throw new Error("must not call"); });
  for (const headers of [{ "next-router-prefetch": "1" }, { "sec-purpose": "prefetch" }]) {
    const response = await visit(get, headers);
    assert.equal(response.url, "https://fixture.invalid/signup");
    assert.equal(response.cookies.deleteCalls.length, 0);
    assert.equal(response.cookies.setCalls.length, 0);
  }
  assert.equal(calls, 0);
});
test("successful explicit referral opens a fresh secure token", async () => {
  const codes = [];
  const get = loadRoute(() => ({ rpc: async (name, args) => {
    assert.equal(name, "ambassador_open_referral");
    codes.push(args.p_code);
    return { data: "fixture-token-" + codes.length };
  } }));
  const first = await visit(get, {}, "testcode");
  const second = await visit(get, {}, "testcode");
  assert.deepEqual(codes, ["TESTCODE", "TESTCODE"]);
  assert.deepEqual(first.cookies.setCalls[0], ["fixture_referral", "fixture-token-1", { maxAge: 1800, httpOnly: true, path: "/", sameSite: "lax", secure: true }]);
  assert.equal(second.cookies.setCalls[0][1], "fixture-token-2");
  assert.equal(first.cookies.deleteCalls.length, 0);
});
