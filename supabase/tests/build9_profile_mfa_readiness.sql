-- Build 9 read-only staging readiness report.
-- Safe to run before installing MFA or profile-boundary migrations.
-- A missing dependency is reported as NOT_READY, not silently accepted.
SELECT
  CASE WHEN to_regprocedure('public.get_public_player_profile(uuid)') IS NOT NULL
       THEN 'PRESENT' ELSE 'MISSING' END AS public_profile_rpc,
  CASE WHEN to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NOT NULL
       THEN 'PRESENT' ELSE 'MISSING' END AS mfa_helper,
  CASE WHEN to_regprocedure('hoopcheck_security.player_profile(uuid)') IS NOT NULL
       THEN 'PRESENT' ELSE 'MISSING' END AS canonical_profile_boundary,
  CASE WHEN EXISTS (
       SELECT 1 FROM pg_policies WHERE policyname='hoopcheck_opted_in_mfa')
       THEN 'PRESENT' ELSE 'MISSING' END AS mfa_restrictive_policies,
  CASE WHEN EXISTS (
       SELECT 1 FROM pg_roles WHERE rolname='authenticator'
       AND EXISTS (
         SELECT 1 FROM unnest(coalesce(rolconfig,ARRAY[]::text[])) cfg
         WHERE cfg='pgrst.db_pre_request=hoopcheck_security.require_mfa'))
       THEN 'PRESENT' ELSE 'MISSING' END AS postgrest_mfa_hook,
  CASE WHEN to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NOT NULL
        AND to_regprocedure('hoopcheck_security.player_profile(uuid)') IS NOT NULL
        AND EXISTS (SELECT 1 FROM pg_policies WHERE policyname='hoopcheck_opted_in_mfa')
       THEN 'REQUIRES_RUNTIME_TESTS' ELSE 'NOT_READY' END AS staging_gate;
-- Readiness does not prove production compatibility or installed Build 7 behavior.
