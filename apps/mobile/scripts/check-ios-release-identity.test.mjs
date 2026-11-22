import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const app = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8"));
const script = new URL("./check-ios-release-identity.cjs", import.meta.url).pathname;
const check = approved => spawnSync(process.execPath, [script], {
  encoding: "utf8",
  env: { ...process.env, HOOPCHECK_APPROVED_IOS_BUNDLE_ID: approved },
});

test("Build 9 holds if the Apple-approved bundle is not provided", () => {
  const result = check("");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /BUILD 9 HOLD/);
});

test("Build 9 refuses signing with a different bundle identifier", () => {
  const result = check("com.unapproved.hoopcheck.app");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /differs from explicitly approved/);
});

test("Build 9 identity guard validates configuration without queuing EAS", () => {
  const result = check(app.expo.ios.bundleIdentifier);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /NOT TestFlight-ready/);
});
