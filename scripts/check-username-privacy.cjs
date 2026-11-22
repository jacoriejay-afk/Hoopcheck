/* eslint-disable @typescript-eslint/no-require-imports -- standalone security regression */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("app/search/page.tsx", "utf8");
const start = source.indexOf("wantsPlayers && username && page === 1");
assert.ok(start >= 0, "Exact username lookup must exist");

if (source.slice(start, start + 250).includes('supabase.rpc("search_public_players_by_username"')) {
  // Build 9: prefer the verified production SECURITY INVOKER projection rather
  // than a raw profiles SELECT. It protects both the avatar and opt-out country
  // in results and country-filter predicates.
  const sql = fs.readFileSync("supabase/migrations/20261122040018_build8_public_readonly_rpc_compat_20261122.sql", "utf8");
  assert.match(source.slice(start, start + 750), /supabase\.rpc\("search_public_players_by_username"/);
  assert.match(source.slice(start, start + 750), /p_username: username/);
  assert.match(source.slice(start, start + 750), /username\?\.toLowerCase\(\) === username\.toLowerCase\(\)/);
  assert.match(sql, /CASE WHEN p\.current_country_public IS TRUE THEN p\.current_country ELSE NULL END/i,
    "Country opt-out must be masked in the server projection");
  assert.match(sql, /p\.current_country_public IS TRUE AND/i,
    "Country filter must not query opted-out locations");
  assert.match(sql, /coalesce\(p\.avatar_moderation_status,'approved'\)='approved'/i,
    "Server must hide pending/unapproved avatar data");
  assert.match(sql, /p\.profile_visibility='public'/,
    "Private players must not appear in public username lookup");
  assert.match(sql, /p\.moderation_status,'normal'\) <> 'suspended'/,
    "Suspended players must not appear in public username lookup");
  assert.doesNotMatch(source.slice(start, start + 750), /\.from\("profiles"\)/,
    "Build 9 exact username must not bypass the guarded RPC");
} else {
  // Older website client: allow only an explicit non-location projection and
  // require client-side avatar masking before constructing the result.
  const end = source.indexOf(".maybeSingle()", start);
  assert.ok(end > start, "Legacy exact username query must be bounded");
  const lookup = source.slice(start, end + ".maybeSingle()".length);
  const projection = lookup.match(/\.select\("([^"]+)"\)/)?.[1];
  assert.ok(projection, "Exact username lookup must have an explicit column projection");
  const columns = projection.split(",").map(part => part.trim());
  assert.ok(!columns.includes("current_country") && !columns.includes("*"),
    "Never retrieve raw private country for an exact username result");
  assert.ok(columns.includes("avatar_moderation_status"), "Avatar moderation must be checked");
  assert.match(source, /avatar_moderation_status === null/);
  assert.match(source, /avatar_moderation_status === "approved"\)\s*\?\s*rawUsernameMatch\.avatar_url\s*:\s*null/);
  assert.match(source, /current_country:\s*null/);
}
console.log("PASS: exact username lookup masks private country and unapproved avatars");
