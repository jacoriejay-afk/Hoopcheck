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
// The installed Store Build 8 requires this missing server RPC. Keep its
// additive, review-only compatibility candidate narrowly RLS-scoped, without
// accidentally rolling it into production migrations or granting raw reads.
const ownerRpc = fs.readFileSync("supabase/candidates/build8_additive_owner_profile_invoker.sql", "utf8");
assert.match(ownerRpc, /CREATE FUNCTION public\.get_own_profile\(\)/, "Candidate must install exact no-argument owner RPC");
assert.match(ownerRpc, /RETURNS jsonb/, "Candidate must keep the existing native JSON contract");
assert.match(ownerRpc, /SECURITY INVOKER/, "Candidate must use caller's existing RLS and column grants");
assert.ok(ownerRpc.includes("has_column_privilege('authenticated'"), "Every projected field must retain explicit column-level SELECT preflight");
assert.doesNotMatch(ownerRpc, /IF NOT has_table_privilege\('authenticated','public\.profiles','SELECT'\)/, "A table-wide SELECT preflight would reject production's least-privilege column grants");
assert.match(ownerRpc, /SET search_path = ''/, "Candidate function must have a fixed search path");
assert.match(ownerRpc, /WHERE p\.id = \(SELECT auth\.uid\(\)\)/, "Owner predicate must be based only on signed JWT");
assert.match(ownerRpc, /to_regprocedure\('public\.get_own_profile\(\)'\) IS NOT NULL/, "Never overwrite an already installed owner RPC");
assert.match(ownerRpc, /REVOKE ALL ON FUNCTION public\.get_own_profile\(\) FROM PUBLIC, anon/, "Anonymous owner-RPC execute must be denied");
assert.match(ownerRpc, /GRANT EXECUTE ON FUNCTION public\.get_own_profile\(\) TO authenticated/, "Authenticated-only owner RPC");
assert.ok(ownerRpc.includes("coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'false'"), "Anonymous Auth sessions must fail closed");
for (const name of [
  "id", "account_type", "display_name", "bio", "hometown", "nationality",
  "favorite_teams", "favorite_leagues", "interests", "experience_summary",
  "position", "height", "current_country", "current_team", "free_agent",
  "current_country_public", "profile_visibility", "first_name", "last_name",
  "years_pro", "username", "avatar_url", "avatar_moderation_status",
  "player_verified", "player_verified_at", "basketball_type",
  "theme_preference", "preferred_language", "notification_preferences",
]) assert.ok(ownerRpc.includes("'"+name+"', p."+name), "Missing explicit installed-client projection: "+name);
assert.doesNotMatch(ownerRpc, /\b(?:DROP TABLE|ALTER TABLE|GRANT SELECT|REVOKE SELECT|SECURITY DEFINER)\b/i, "Candidate cannot modify profile grants, RLS or bypass callers");
assert.ok(!ownerRpc.includes("p.*"), "Never return all profile fields or unrestricted billing identity");

// Build 9 profile editor must not be enabled over existing broad privileged
// UPDATE column grants. These are reviewed staging candidates, not an
// instruction to revoke production/admin/old-client permissions blindly.
const editorCandidate = fs.readFileSync("supabase/candidates/build9_native_profile_editor_write.sql", "utf8");
const editorAclTest = fs.readFileSync("supabase/tests/build9_profile_editor_write_preflight.sql", "utf8");
for (const field of [
  "id", "account_type", "birthdate", "stripe_identity_verification_session_id",
  "identity_verification_status", "player_verified", "player_verified_at",
  "coach_verified", "coach_verified_at", "profile_claimed", "claimed_at",
  "moderation_status", "moderation_note", "moderation_updated_at",
  "moderation_updated_by", "avatar_moderation_status",
  "avatar_moderation_note", "selected_team_verified",
]) {
  for (const [name, text] of [["migration candidate", editorCandidate], ["staging preflight", editorAclTest]]) {
    assert.ok(text.includes("'"+field+"'"), name+" must guard direct authenticated UPDATE on "+field);
  }
}
for (const [name, text] of [["migration candidate", editorCandidate], ["staging preflight", editorAclTest]]) {
  assert.ok(text.includes("has_table_privilege('authenticated','public.profiles','UPDATE')"), name+" must reject table-wide UPDATE grants");
  assert.ok(text.includes("has_column_privilege('authenticated','public.profiles',a.attname,'UPDATE')"), name+" must reject protected-column UPDATE grants");
  assert.ok(text.includes("pg_attribute"), name+" must check only installed protected columns");
}
assert.ok(editorCandidate.includes("AS RESTRICTIVE"), "Editor policy must AND owner/MFA against all existing policies");
assert.ok(editorCandidate.includes("hoopcheck_security.mfa_satisfied()"), "Do not activate editor without verified MFA helper");

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
