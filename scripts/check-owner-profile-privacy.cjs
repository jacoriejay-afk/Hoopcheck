/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS CI regression tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const helper = fs.readFileSync("lib/read-own-profile.ts", "utf8");
assert.match(helper, /legacy\.error\.code !== "42501"/, "Only permission errors should trigger owner RPC fallback");
assert.match(helper, /supabase\.rpc\("get_own_profile"\)/, "Fallback must use protected owner RPC");
assert.match(helper, /\.id !== userId/, "Never trust a projection for another account");
for (const filename of [
  "app/account/page.tsx",
  "app/dashboard/page.tsx",
  "app/profile/page.tsx",
  "app/players/[id]/page.tsx",
  "components/PlayerProfileCompletionCard.tsx",
]) {
  const source = fs.readFileSync(filename, "utf8");
  assert.match(source, /readOwnProfile/, filename + " must support restricted owner reads");
}
const dashboard = fs.readFileSync("app/dashboard/page.tsx", "utf8");
assert.match(dashboard, /withTimeout\(readOwnProfile<Profile>\(user\.id/, "Dashboard must use guarded profile owner projection");
assert.doesNotMatch(dashboard, /supabase\.from\("profiles"\)\.select\("id,display_name,first_name/, "Dashboard must not directly depend on the protected-column SELECT");
const completion = fs.readFileSync("components/PlayerProfileCompletionCard.tsx", "utf8");
assert.match(completion, /\.update\(\{ profile_visibility: "public" \}\)/);
assert.match(completion, /\.select\("id"\)/, "UPDATE RETURNING should not ask for private data");
console.log("PASS owner-bound profile reads and UPDATE RETURNING are compatible with privacy rollout");
