import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");

test("real iOS Passport smoke grants a bounded cold-print allowance without weakening production", () => {
  const fixture = read("./ios-passport-smoke/entry.tsx");
  const ui = read("./ios-passport-smoke/PassportUITests.swift");
  const exporter = read("../src/native/passportSharing.ts");

  assert.match(fixture, /CI-only standalone entry/);
  assert.match(fixture, /timeoutMs: 90000/);
  assert.match(fixture, /PASSPORT_SMOKE_PRINT_FAILURE/);
  assert.match(fixture, /PASSPORT_SMOKE_PRINT_ELAPSED_MS/);
  assert.match(fixture, /CI Synthetic Player/);
  assert.match(fixture, /registerRootComponent\(PassportSmoke\)/);
  assert.doesNotMatch(fixture, /supabase\.auth|service_role|\bfetch\(/);

  assert.match(ui, /share\.waitForExistence\(timeout: 105\)/);
  assert.match(ui, /passport-smoke-status/);
  assert.match(ui, /native-share-sheet/);
  assert.match(ui, /CLEANED/);

  // The shipped app still cancels a stuck print after 30 seconds by default.
  assert.match(exporter, /io\.timeoutMs \?\? 30000/);
  assert.match(exporter, /if \(uri\)/);
  assert.match(exporter, /await io\.remove\(uri\)/);
});
