import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Static regression guard only: end-to-end auth, Storage and expiry need sandbox tests.
const route = readFileSync(new URL("../../../../app/api/native2/highlight-download/route.ts", import.meta.url), "utf8");
test("highlight download is disabled by default before token or service-role access", () => {
  const gate = route.indexOf('process.env.NATIVE2_MEDIA_DOWNLOADS_ENABLED !== "true"');
  const auth = route.indexOf("auth.getUser(token)");
  const admin = route.indexOf("SUPABASE_SERVICE_ROLE_KEY");
  assert.ok(gate > 0 && gate < auth && gate < admin);
});
test("highlight download verifies user, record ownership, ready status, and short-lived signing", () => {
  assert.match(route, /auth\.getUser\(token\)/);
  assert.match(route, /\.eq\("owner_id", identity\.user\.id\)/);
  assert.match(route, /asset\.status !== "ready"/);
  assert.match(route, /native2AuthorizeOwnerMedia\(/);
  assert.match(route, /createSignedUrl\(asset\.private_storage_path, 60\)/);
  assert.doesNotMatch(route, /getPublicUrl\(/);
});
