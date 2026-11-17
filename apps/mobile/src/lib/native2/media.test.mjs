import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import { test } from "node:test";

const source = readFileSync(new URL("./media.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandboxModule = { exports: {} };
vm.runInNewContext(code, { module: sandboxModule, exports: sandboxModule.exports });
const { native2MediaObjectPath: path, native2CanAccessMedia: access } = sandboxModule.exports;
const owner = "11111111-1111-4111-8111-111111111111";
const stranger = "22222222-2222-4222-8222-222222222222";
const asset = "33333333-3333-4333-8333-333333333333";

test("media path is normalized and has no caller-supplied segments", () => {
  assert.equal(path(owner, asset, "mp4"), `${owner}/${asset}.mp4`);
  assert.throws(() => path("../etc", asset, "mp4"));
  assert.throws(() => path(owner, asset, "exe"));
});
test("media access is owner-only and bucket-scoped", () => {
  const key = path(owner, asset, "mp4");
  assert.equal(access("highlight", "native2-highlights", key, owner, owner, asset), true);
  assert.equal(access("highlight", "native2-highlights", key, stranger, owner, asset), false);
  assert.equal(access("highlight", "native2-verification-videos", key, owner, owner, asset), false);
  assert.equal(access("verification", "native2-verification-videos", key, stranger, owner, asset), false);
  assert.equal(access("highlight", "native2-highlights", `${owner}/../${asset}.mp4`, owner, owner, asset), false);
  assert.equal(access("highlight", "native2-highlights", `${owner}/${asset}.exe`, owner, owner, asset), false);
});
