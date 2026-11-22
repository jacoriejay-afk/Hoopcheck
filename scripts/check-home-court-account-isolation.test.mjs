import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Home Court preferences use authenticated user ID, never the email fallback", () => {
  const dashboard = read("app/dashboard/page.tsx");
  assert.match(dashboard, /setAuthenticatedUserId\(user\.id\)/);
  assert.match(dashboard, /<HomeCourtSpace profileId=\{authenticatedUserId\}/);
  assert.doesNotMatch(dashboard, /<HomeCourtSpace profileId=\{profile\?\.id \|\| email\}/);
});

test("Cross-account transitions cannot render or persist previous account's Court", () => {
  const court = read("app/dashboard/HomeCourtSpace.tsx");
  assert.match(court, /setLoadedProfileId\(profileId\)/);
  assert.match(court, /if \(!profileId \|\| loadedProfileId !== profileId\) return;/);
  assert.match(court, /if \(!profileId \|\| loadedProfileId !== profileId\) return null;/);
  assert.match(court, /window\.localStorage\.setItem\("hc-court-v1:" \+ profileId/);
  assert.match(court, /\[loadedProfileId, profileId, prefs\]/);
});
