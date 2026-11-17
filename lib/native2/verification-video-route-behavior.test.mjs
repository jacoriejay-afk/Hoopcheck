import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("../../app/api/native2/verification-video-download/route.ts", import.meta.url), "utf8");
const policySource = readFileSync(new URL("./server-media-policy.ts", import.meta.url), "utf8");
const compile = input => ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";

function fixture({ enabled = true, tokenUser = owner, recordOwner = owner, requestOwner = owner, trustedRequestId = requestId, expiresAt = "2099-01-01T00:00:00Z", path = `${owner}/${assetId}.mp4`, signError = false, requestError = false } = {}) {
  const calls = { auth: 0, asset: 0, request: 0, sign: 0 };
  const policyModule = { exports: {} };
  vm.runInNewContext(compile(policySource), { module: policyModule, exports: policyModule.exports, Date });
  const response = { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers }) };
  const admin = {
    from(table) {
      const query = {
        select() { return this; }, eq() { return this; },
        async maybeSingle() {
          if (table === "native2_verification_video_assets") {
            calls.asset++;
            return { data: recordOwner ? { id: assetId, owner_id: recordOwner, request_id: requestId, private_storage_path: path, expires_at: expiresAt } : null, error: null };
          }
          if (table === "player_verification_requests") {
            calls.request++;
            return { data: requestOwner ? { id: trustedRequestId, user_id: requestOwner } : null, error: requestError ? new Error("database error") : null };
          }
          throw Error("Unexpected table");
        },
      };
      return query;
    },
    storage: { from: () => ({ async createSignedUrl() {
      calls.sign++;
      return signError ? { error: new Error("storage error"), data: null } : { data: { signedUrl: "https://example.invalid/signed" }, error: null };
    } }) },
  };
  const userClient = { auth: { async getUser() { calls.auth++; return { data: { user: tokenUser ? { id: tokenUser } : null }, error: null }; } } };
  let clients = 0;
  const routeModule = { exports: {} };
  const env = enabled ? { NATIVE2_VERIFICATION_VIDEO_DOWNLOADS_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable", SUPABASE_SERVICE_ROLE_KEY: "test-only" } : {};
  vm.runInNewContext(compile(source), {
    module: routeModule, exports: routeModule.exports, process: { env }, Date,
    require(name) {
      if (name === "next/server") return { NextResponse: response };
      if (name === "@supabase/supabase-js") return { createClient: () => (++clients === 1 ? userClient : admin) };
      if (name.endsWith("server-media-policy")) return policyModule.exports;
      throw Error(`Unexpected module: ${name}`);
    },
  });
  const request = (body = { assetId }, authorization = "Bearer mock-token") => ({
    headers: { get: () => authorization }, json: async () => body,
  });
  return { post: routeModule.exports.POST, request, calls };
}

test("disabled video route makes no auth or storage calls", async () => {
  const f = fixture({ enabled: false });
  assert.equal((await f.post(f.request())).status, 404);
  assert.deepEqual(f.calls, { auth: 0, asset: 0, request: 0, sign: 0 });
});
test("invalid token, missing auth and invalid asset IDs fail closed", async () => {
  const f = fixture();
  assert.equal((await f.post(f.request({ assetId }, ""))).status, 401);
  assert.equal((await f.post(f.request({ assetId: "../unsafe" }))).status, 400);
  const invalid = fixture({ tokenUser: null });
  assert.equal((await invalid.post(invalid.request())).status, 401);
  assert.equal(f.calls.sign, 0);
});
test("cross-user video and request ownership never sign", async () => {
  for (const options of [{ recordOwner: other }, { requestOwner: other }, { trustedRequestId: other }, { requestOwner: null }, { requestError: true }]) {
    const f = fixture(options);
    assert.notEqual((await f.post(f.request())).status, 200);
    assert.equal(f.calls.sign, 0);
  }
});
test("expired video and invalid object path never sign", async () => {
  for (const options of [{ expiresAt: "2020-01-01T00:00:00Z" }, { path: `${other}/${assetId}.mp4` }]) {
    const f = fixture(options);
    assert.equal((await f.post(f.request())).status, 404);
    assert.equal(f.calls.sign, 0);
  }
});
test("valid owner receives 60-second signed URL, storage errors fail closed", async () => {
  const f = fixture();
  const result = await f.post(f.request());
  assert.equal(result.status, 200);
  assert.equal(result.body.expiresIn, 60);
  assert.equal(f.calls.sign, 1);
  const error = fixture({ signError: true });
  assert.equal((await error.post(error.request())).status, 503);
});
