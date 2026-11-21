-- Build 9 profile/MFA contract checks (read-only, rollback-only).
-- Run AFTER the opt-in MFA and profile-boundary migrations on an isolated staging clone.
-- Do not run on production or treat this as proof of installed Build 7 compatibility.
BEGIN;
DO $$
DECLARE
  profile_fn oid := to_regprocedure('public.get_public_player_profile(uuid)');
  mfa_fn oid := to_regprocedure('hoopcheck_security.mfa_satisfied()');
  expected_cols text;
BEGIN
  IF profile_fn IS NULL THEN RAISE EXCEPTION 'Missing public player-profile RPC'; END IF;
  IF mfa_fn IS NULL THEN RAISE EXCEPTION 'Missing MFA helper: apply staged prerequisite first'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=profile_fn AND prosecdef) AND
     NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('hoopcheck_security.player_profile(uuid)') AND prosecdef)
  THEN RAISE EXCEPTION 'Missing verified security-definer profile boundary'; END IF;
  IF has_function_privilege('anon','hoopcheck_security.mfa_satisfied()','EXECUTE') IS FALSE
  THEN RAISE EXCEPTION 'Anonymous public profile access cannot check MFA'; END IF;
  IF has_function_privilege('authenticated','hoopcheck_security.mfa_satisfied()','EXECUTE') IS FALSE
  THEN RAISE EXCEPTION 'Authenticated profile access cannot check MFA'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid=profile_fn AND pg_get_functiondef(oid) ILIKE '%current_country_public%' AND pg_get_functiondef(oid) NOT ILIKE '%auth.uid%')
  THEN RAISE NOTICE 'Profile RPC may delegate owner country visibility; inspect definer target'; END IF;
  RAISE NOTICE 'Static MFA/profile prerequisites present; runtime matrix still required';
END $$;
-- Runtime acceptance matrix (separate rollback-only fixture transaction):
-- 1. verified factor + aal1 => profile RPC returns zero rows.
-- 2. verified factor + aal2 => permitted public player returns one row.
-- 3. owner + aal2 + current_country_public=false => owner sees current_country.
-- 4. unrelated anon + current_country_public=false => current_country is NULL.
-- 5. private/suspended profiles => zero rows; players_only requires real player viewer.
-- 6. Validate direct legacy Build 7 SELECTs before restricting profile columns.
ROLLBACK;
