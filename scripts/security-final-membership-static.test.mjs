// SECURITY-FINAL: zero-cost, static guardrails for the proposed membership RPC.
// Run: node --test scripts/security-final-membership-static.test.mjs
// This does NOT replace isolated role/JWT integration tests.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sql = readFileSync(new URL('../docs/security/security-final-admin-only-membership-candidate.sql', import.meta.url), 'utf8');
const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION'), sql.indexOf('$function$;', sql.indexOf('CREATE OR REPLACE FUNCTION')));

test('requires exact administrator role, not moderator role', () => {
  assert.match(fn, /FROM public\.admin_roles ar/i);
  assert.match(fn, /ar\.user_id\s*=\s*\(SELECT auth\.uid\(\)\)/i);
  assert.match(fn, /lower\(btrim\(coalesce\(ar\.role, ''\)\)\)\s*=\s*'admin'/i);
  assert.doesNotMatch(fn, /is_current_user_admin_or_moderator/i);
  assert.match(fn, /errcode\s*=\s*'42501'/i);
});

test('preserves Stripe-linked subscription rejection', () => {
  assert.match(fn, /nullif\(btrim\(s\.stripe_subscription_id\), ''\) IS NOT NULL/i);
  assert.match(fn, /Manage the subscription through the billing workflow first/i);
});

test('rejects null and unknown plans and retains all existing plan values', () => {
  assert.match(fn, /p_plan NOT IN \('free', 'pro', 'premium'\) OR p_plan IS NULL/i);
  assert.match(fn, /errcode\s*=\s*'22023'/i);
});

test('hardened function search path and EXECUTE grant', () => {
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_set_membership\(uuid,text\) FROM PUBLIC, anon/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_set_membership\(uuid,text\) TO authenticated/i);
});

test('retains local plan duration and free transition', () => {
  assert.match(fn, /now\(\) \+ interval '1 year'/i);
  assert.match(fn, /IF p_plan = 'free' THEN/i);
  assert.match(fn, /ON CONFLICT \(user_id\) DO UPDATE/i);
});

test('admin UI handles database authorization rejection without saving the profile', () => {
  const ui = readFileSync(new URL('../app/admin/users/page.tsx', import.meta.url), 'utf8');
  assert.match(ui, /supabase\.rpc\("admin_set_membership"/);
  assert.match(ui, /error\.code==="42501"\?"Only administrators can change memberships\. No account changes were saved\."/);
  const call = ui.indexOf('supabase.rpc("admin_set_membership"');
  const profileSave = ui.indexOf('const profileSaved=await save()', call);
  assert.ok(call >= 0 && profileSave > call, 'membership RPC precedes profile save');
  assert.match(ui.slice(call, profileSave), /if\(error\)\{setMessage\([\s\S]*?\);return;\}/);
});

test('membership editor requires admin role and preserves moderator profile save', () => {
  const ui = readFileSync(new URL('../app/admin/users/page.tsx', import.meta.url), 'utf8');
  assert.match(ui, /supabase\.rpc\("get_current_user_admin_role"\)/);
  assert.match(ui, /setCanManageIdentity\(role==="admin"\)/);
  assert.match(ui, /\{canManageIdentity&&<>\<label>Membership<select/);
  assert.match(ui, /if\(!canManageIdentity\)\{await save\(\);return;\}/);
  assert.match(ui, /const profileSaved=await save\(\)/);
});

test('follow UI rejects self-follows and rolls back rejected authorization', () => {
  const ui = readFileSync(new URL('../components/FollowButton.tsx', import.meta.url), 'utf8');
  assert.match(ui, /\(targetType === "player" \|\| targetType === "fan"\) && id === targetId/);
  assert.match(ui, /showFailure\("You cannot follow your own profile\."\)/);
  assert.match(ui, /result\.error\.code === "42501" \|\| result\.error\.code === "23514"/);
  assert.match(ui, /setFollowing\(wasFollowing\)/);
  assert.match(ui, /setCount\(previousCount\)/);
});

test('blocking candidate has owner-only RLS and shared pair locking', () => {
  const candidate = readFileSync(new URL('../docs/security/security-final-user-blocking-candidate.sql', import.meta.url), 'utf8');
  assert.match(candidate, /CREATE TABLE public\.user_blocks/);
  assert.doesNotMatch(candidate, /CREATE TABLE IF NOT EXISTS public\.user_blocks/);
  assert.match(candidate, /REVOKE ALL ON public\.user_blocks FROM PUBLIC, anon, authenticated/);
  assert.match(candidate, /PRIMARY KEY \(blocker_id, blocked_id\)/);
  assert.match(candidate, /ALTER TABLE public\.user_blocks ENABLE ROW LEVEL SECURITY/);
  assert.match(candidate, /CREATE POLICY user_blocks_insert_own[\s\S]*?WITH CHECK \(blocker_id = \(SELECT auth\.uid\(\)\)\)/);
  assert.match(candidate, /CREATE POLICY user_blocks_delete_own[\s\S]*?USING \(blocker_id = \(SELECT auth\.uid\(\)\)\)/);
  assert.match(candidate, /CREATE TRIGGER security_final_lock_block_pair[\s\S]*?BEFORE INSERT ON public\.user_blocks/);
  assert.match(candidate, /PERFORM public\.security_final_lock_user_pair\(NEW\.follower_id, NEW\.target_id\)/);
  assert.match(candidate, /PERFORM public\.security_final_lock_user_pair\(NEW\.blocker_id, NEW\.blocked_id\)/);
  assert.match(candidate, /CREATE TRIGGER security_final_reject_blocked_follow[\s\S]*?BEFORE INSERT OR UPDATE OF follower_id, target_type, target_id/);
  assert.match(candidate, /CREATE TRIGGER security_final_block_cleanup[\s\S]*?AFTER INSERT ON public\.user_blocks/);
  assert.match(candidate, /REVOKE ALL ON FUNCTION public\.security_final_lock_user_pair\(uuid,uuid\)[\s\S]*?FROM PUBLIC, anon, authenticated/);
});
