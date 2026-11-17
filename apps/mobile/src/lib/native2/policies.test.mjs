import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import { test } from "node:test";

const base = new URL("./", import.meta.url);
const load = (name, require) => {
  const source = readFileSync(new URL(name, base), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require });
  return module.exports;
};
const contracts = load("contracts.ts", () => { throw Error("unexpected import"); });
const policies = load("policies.ts", (name) => {
  assert.equal(name, "./contracts");
  return contracts;
});
test("all four features remain disabled", () => {
  assert.equal(Object.keys(contracts.NATIVE2_ENABLED).length, 4);
  assert.ok(Object.values(contracts.NATIVE2_ENABLED).every(value => value === false));
});
test("attendance never bypasses chat window or authorization", () => {
  assert.equal(policies.mayOpenAttendanceChat(true, true, true), true);
  assert.equal(policies.mayOpenAttendanceChat(true, false, true), false);
  assert.equal(policies.mayOpenAttendanceChat(true, true, false), false);
});
test("check-in preflight rejects bad coordinates, timing and venue mismatch", () => {
  const e = { gameId:"g", venueId:"v", gameVenueId:"v", metersFromVenue:30, accuracyMeters:10, withinGameWindow:true, permissionGranted:true };
  assert.equal(policies.checkInPreflight(e), true);
  for (const bad of [{ venueId:"other" }, { metersFromVenue:Infinity }, { accuracyMeters:101 }, { withinGameWindow:false }, { permissionGranted:false }, { metersFromVenue:-1 }]) {
    assert.equal(policies.checkInPreflight({ ...e, ...bad }), false);
  }
});
test("travel requires valid country code", () => {
  assert.equal(policies.normalizeCountryCode(" az "), "AZ");
  assert.equal(policies.normalizeCountryCode("Azerbaijan"), null);
});
test("highlight publishing requires branding, entitlement and moderation", () => {
  const clip = { status:"ready", watermarkApplied:true, endCardApplied:true };
  assert.equal(policies.mayPublishHighlight(clip, true, true), true);
  assert.equal(policies.mayPublishHighlight({ ...clip, endCardApplied:false }, true, true), false);
  assert.equal(policies.mayPublishHighlight(clip, false, true), false);
  assert.equal(policies.mayPublishHighlight(clip, true, false), false);
});
