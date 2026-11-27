import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const account = readFileSync(new URL("../app/account.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../app/settings.tsx", import.meta.url), "utf8");

test("account has an accessible Settings entry before the account-loading branch", () => {
  const header = account.indexOf('testID="account-open-settings"');
  assert.ok(header >= 0 && header < account.indexOf('{loading&&!account?'));
  assert.match(account, /accessibilityLabel="Settings" testID="account-open-settings" onPress=\{\(\)=>router\.push\("\/settings"\)\}/);
});

test("settings prioritizes account navigation and exposes only verified HQ grants", () => {
  assert.ok(settings.indexOf("Account & community") < settings.indexOf("Device preferences"));
  assert.match(settings, /useNativeAccount\(\)/);
  assert.match(settings, /\{account\.workspaces\.owner \? <Pressable testID="settings-owner-hq"/);
  assert.match(settings, /\{account\.workspaces\.ambassador \? <Pressable testID="settings-ambassador-hq"/);
  assert.match(settings, /!account && !accountLoading && accountError/);
  assert.match(settings, /onPress=\{retryAccount\}/);
});

test("settings retains appearance, account lock, haptics and public cache controls", () => {
  for (const control of ["Midnight Black", "Device app lock", "Haptics", "Clear cached directory data", "AlternateIcons"]) assert.ok(settings.includes(control), control);
});
