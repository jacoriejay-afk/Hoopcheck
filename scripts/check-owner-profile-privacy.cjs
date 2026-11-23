/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS CI regression tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const helper = fs.readFileSync("lib/read-own-profile.ts", "utf8");
assert.ok(helper.includes('legacy.error?.code === "42501"'), "Only permission errors may trigger owner RPC fallback");
assert.equal(helper.split("supabase.auth.getSession()").length - 1, 2, "Owner reads must capture and recheck the session");
assert.ok(helper.includes('const projection = columns.split(",")'), "Owner identity must be included in all legacy projections");
assert.equal(helper.split('.setHeader("Authorization", `Bearer ${token}`)').length - 1, 2, "Both legacy and RPC requests must pin the captured JWT");
assert.ok(helper.includes("current.data.session.access_token !== token"), "Account switch or token refresh must fail closed");
assert.ok(helper.includes("result.data.id !== userId"), "Owner identity must match the returned projection");
assert.ok(helper.includes('supabase.rpc("get_own_profile")'), "Only the protected owner RPC can handle permission-denied fallback");
for (const filename of [
  "app/account/page.tsx",
  "app/dashboard/page.tsx",
  "app/profile/page.tsx",
  "app/players/[id]/page.tsx",
  "app/settings/page.tsx",
  "components/PlayerProfileCompletionCard.tsx",
]) {
  const source = fs.readFileSync(filename, "utf8");
  assert.match(source, /readOwnProfile/, filename + " must support restricted owner reads");
}
const settings = fs.readFileSync("app/settings/page.tsx", "utf8");
assert.doesNotMatch(settings, /getOwnProfile\(supabase/, "Settings must not call the unavailable owner RPC directly");
assert.match(settings, /readOwnProfile<\{account_type:/, "Settings must use scoped legacy/RPC-compatible owner projection");
const dashboard = fs.readFileSync("app/dashboard/page.tsx", "utf8");
assert.match(dashboard, /withTimeout\(readOwnProfile<Profile>\(user\.id/, "Dashboard must use guarded profile owner projection");
assert.doesNotMatch(dashboard, /supabase\.from\("profiles"\)\.select\("id,display_name,first_name/, "Dashboard must not directly depend on the protected-column SELECT");
const completion = fs.readFileSync("components/PlayerProfileCompletionCard.tsx", "utf8");
assert.match(completion, /\.update\(\{ profile_visibility: "public" \}\)/);
assert.match(completion, /\.select\("id"\)/, "UPDATE RETURNING should not ask for private data");
console.log("PASS owner-bound profile reads and UPDATE RETURNING are compatible with privacy rollout");
