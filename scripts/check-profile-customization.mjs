import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const appearance = read("components/ProfileAppearance.tsx");
const header = read("components/SocialProfileHeader.tsx");
const profile = read("app/profile/page.tsx");
const latest = read("components/ProfileLatestPost.tsx");
const styles = read("app/hoopcheck-discovery-profile.css");

assert.match(appearance, /hoopcheck_profile_layout/);
assert.match(appearance, /hoopcheck_social_links/);
assert.match(appearance, /validSocialUrl/);
assert.match(appearance, /url\.protocol !== "https:"/);
assert.match(profile, /rel="noopener noreferrer"/);
assert.match(profile, /data-profile-layout=\{profileLayout\}/);
assert.match(profile, /ProfileLatestPost userId=\{p\.id\}/);
assert.match(latest, /\.eq\("status", "approved"\)/);
assert.match(latest, /expires_at\.is\.null,expires_at\.gt/);
assert.match(latest, /\.order\("created_at", \{ ascending: false \}\)\.limit\(1\)/);
assert.match(styles, /hc-profile-social-links/);
for (const name of ["forest", "gold", "midnight", "coral"]) {
  assert.ok(header.includes(`id: "${name}"`));
  assert.ok(styles.includes(`data-profile-cover="${name}"`));
}
console.log("Profile customization static contracts passed");
