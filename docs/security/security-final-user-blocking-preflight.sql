-- SECURITY-FINAL: READ-ONLY preflight for unexecuted user-blocking candidate.
-- Safe to run against production. Every statement is SELECT only.
-- A green preflight is NOT authorization to apply the candidate.
SELECT
  to_regclass('public.follow_relationships') IS NOT NULL AS follow_table_exists,
  to_regclass('public.user_blocks') IS NULL AS user_blocks_not_yet_present,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='follow_relationships'
      AND column_name='follower_id' AND udt_name='uuid'
  ) AS follower_uuid,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='follow_relationships'
      AND column_name='target_id' AND udt_name='uuid'
  ) AS target_uuid,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='follow_relationships'
      AND column_name='target_type'
  ) AS target_type_exists;

-- Existing triggers may impose ordering, locks or side effects.
SELECT tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS trigger_definition,
       p.proname AS function_name,
       p.prosecdef AS security_definer
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_proc p ON p.oid=t.tgfoid
WHERE n.nspname='public' AND c.relname='follow_relationships'
  AND NOT t.tgisinternal
ORDER BY tgname;

-- Check follow table row security, existing grants, and policies.
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='follow_relationships';
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='follow_relationships'
ORDER BY policyname;
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='follow_relationships'
ORDER BY grantee, privilege_type;

-- Candidate assumes both identities refer to auth.users(id).
-- Report orphaned rows without exposing user identifiers.
SELECT
  count(*) FILTER (WHERE u1.id IS NULL) AS missing_follower_auth_user,
  count(*) FILTER (WHERE fr.target_type IN ('player','fan') AND u2.id IS NULL) AS missing_person_target_auth_user,
  count(*) FILTER (WHERE fr.target_type IN ('player','fan') AND fr.follower_id=fr.target_id) AS existing_self_follows
FROM public.follow_relationships fr
LEFT JOIN auth.users u1 ON u1.id=fr.follower_id
LEFT JOIN auth.users u2 ON u2.id=fr.target_id;

-- RELEASE GATES:
-- 1. Validate pair-lock behavior with two concurrent authenticated transactions.
-- 2. Confirm no deadlocks with existing follow triggers and block cleanup.
-- 3. Test block-first, follow-first, simultaneous blocks, unblock/refollow.
-- 4. Audit all service-role routes and SECURITY DEFINER social RPCs.
-- 5. Obtain explicit production-migration approval separately.
