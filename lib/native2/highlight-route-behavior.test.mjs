import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("../../app/api/native2/highlight-download/route.ts", import.meta.url), "utf8");
const policySource = readFileSync(new URL("./server-media-policy.ts", import.meta.url), "utf8");
const compile = (input) => ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";

function buildRoute({ enabled = true, tokenUser = owner, recordOwner = owner, status = "ready", path = `${owner}/${assetId}.mp4`, signError = false } = {}) {
  const calls = { auth: 0, lookup: 0, sign: 0 };
  const policyModule = { exports: {} };
  vm.runInNewContext(compile(policySource), { module: policyModule, exports: policyModule.exports, Date });
  const response = { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers }) };
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() {
      calls.lookup++;
      return { data: recordOwner ? { id: assetId, owner_id: recordOwner, private_storage_path: path, status } : null, error: null };
    },
  };
  const admin = {
    from: () => query,
    storage: { from: () => ({ async createSignedUrl() {
      calls.sign++;
      return signError ? { error: new Error("storage failed"), data: null } : { data: { signedUrl: "https://example.invalid/signed" }, error: null };
    } }) },
  };
  const userClient = { auth: { async getUser() { calls.auth++; return { data: { user: tokenUser ? { id: tokenUser } : null }, error: null }; } } };
  let clients = 0;
  const module = { exports: {} };
  const env = enabled ? { NATIVE2_MEDIA_DOWNLOADS_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable", SUPABASE_SERVICE_ROLE_KEY: "test-only" } : {};
  vm.runInNewContext(compile(source), {
    module, exports: module.exports, process: { env }, Date,
    require(name) {
      if (name === "next/server") return { NextResponse: response };
      if (name === "@supabase/supabase-js") return { createClient: () => (++clients === 1 ? userClient : admin) };
      if (name.endsWith("server-media-policy")) return policyModule.exports;
      throw Error(`Unexpected module: ${name}`);
    },
  });
  const request = (body = { assetId }, authorization = "Bearer mock-token") => ({
    headers: { get: () => authorization },
    json: async () => body,
  });
  return { post: module.exports.POST, request, calls };
}

test("disabled route refuses access before authentication or storage calls", async () => {
  const { post, request, calls } = buildRoute({ enabled: false });
  const result = await post(request());
  assert.equal(result.status, 404);
  assert.deepEqual(calls, { auth: 0, lookup: 0, sign: 0 });
});
test("missing bearer token and malformed asset ID are rejected", async () => {
  const a = buildRoute();
  assert.equal((await a.post(a.request({ assetId }, ""))).status, 401);
  assert.equal((await a.post(a.request({ assetId: "../other" }))).status, 400);
  assert.equal(a.calls.sign, 0);
});
test("invalid identity and cross-user assets never produce a signed URL", async () => {
  const invalid = buildRoute({ tokenUser: null });
  assert.equal((await invalid.post(invalid.request())).status, 401);
  const crossUser = buildRoute({ recordOwner: other });
  assert.equal((await crossUser.post(crossUser.request())).status, 404);
  assert.equal(crossUser.calls.sign, 0);
});
test("not-ready and malformed object paths never produce a signed URL", async () => {
  for (const options of [{ status: "pending" }, { path: `${other}/${assetId}.mp4` }]) {
    const fixture = buildRoute(options);
    assert.equal((await fixture.post(fixture.request())).status, 404);
    assert.equal(fixture.calls.sign, 0);
  }
});
test("owner of ready asset receives short-lived signed URL; signing errors fail closed", async () => {
  const success = buildRoute();
  const result = await success.post(success.request());
  assert.equal(result.status, 200);
  assert.equal(result.body.expiresIn, 60);
  assert.equal(success.calls.sign, 1);
  const failure = buildRoute({ signError: true });
  assert.equal((await failure.post(failure.request())).status, 503);
});
