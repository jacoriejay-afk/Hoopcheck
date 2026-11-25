import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../lib/security/captcha-token.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const exports = {};
new Function("exports", outputText)(exports);
const { createCaptchaTokenStore } = exports;
test("disabled mode preserves legacy login", () => {
  const store = createCaptchaTokenStore(false);
  assert.equal(store.accept(0, "fixture"), null);
  assert.deepEqual(store.take(), { token: undefined, revision: 0 });
});
test("valid responses are consumed only once", () => {
  const store = createCaptchaTokenStore(true);
  assert.equal(store.accept(0, "fixture"), true);
  assert.deepEqual(store.take(), { token: "fixture", revision: 1 });
  assert.deepEqual(store.take(), { token: undefined, revision: 2 });
});
test("callbacks from old widgets cannot replace or clear fresh responses", () => {
  const store = createCaptchaTokenStore(true);
  store.accept(0, "first");
  store.take();
  store.accept(1, "second");
  assert.equal(store.accept(0, "late"), null);
  assert.equal(store.accept(0, ""), null);
  assert.equal(store.take().token, "second");
});
test("expired or malformed responses are rejected", () => {
  let clock = 1000;
  const store = createCaptchaTokenStore(true, () => clock);
  store.accept(0, "fixture");
  clock += 290000;
  assert.equal(store.take().token, undefined);
  assert.equal(store.accept(1, "x".repeat(2049)), false);
  assert.equal(store.take().token, undefined);
});
test("provider expiration clears only the current response", () => {
  const store = createCaptchaTokenStore(true);
  store.accept(0, "fixture");
  assert.equal(store.accept(0, ""), false);
  assert.equal(store.take().token, undefined);
});
