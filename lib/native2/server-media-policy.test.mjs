import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import { test } from "node:test";

const source = readFileSync(new URL("./server-media-policy.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandboxModule = { exports: {} };
vm.runInNewContext(code, { module: sandboxModule, exports: sandboxModule.exports, Date });
const authorize = sandboxModule.exports.native2AuthorizeOwnerMedia;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const asset = "33333333-3333-4333-8333-333333333333";
const base = { kind: "verification", operation: "download", authenticatedUserId: owner, recordOwnerId: owner, recordId: asset, bucket: "native2-verification-videos", objectPath: `${owner}/${asset}.mp4`, requestOwnerId: owner, requestId: asset, trustedRequestId: asset, expiresAt: "2026-12-01T00:00:00Z", now: "2026-11-17T00:00:00Z" };

test("only authenticated owner with matching verification request can access unexpired video", () => {
  assert.equal(authorize(base), true);
  assert.equal(authorize({ ...base, authenticatedUserId: other }), false);
  assert.equal(authorize({ ...base, authenticatedUserId: null }), false);
  assert.equal(authorize({ ...base, requestOwnerId: other }), false);
  assert.equal(authorize({ ...base, requestId: other }), false);
  assert.equal(authorize({ ...base, trustedRequestId: null }), false);
  assert.equal(authorize({ ...base, expiresAt: base.now }), false);
  assert.equal(authorize({ ...base, objectPath: `${owner}/../${asset}.mp4` }), false);
  assert.equal(authorize({ ...base, bucket: "native2-highlights" }), false);
});
test("highlight assets remain owner and bucket scoped", () => {
  const highlight = { ...base, kind: "highlight", bucket: "native2-highlights" };
  assert.equal(authorize(highlight), true);
  assert.equal(authorize({ ...highlight, authenticatedUserId: other }), false);
  assert.equal(authorize({ ...highlight, objectPath: `${other}/${asset}.mp4` }), false);
});
