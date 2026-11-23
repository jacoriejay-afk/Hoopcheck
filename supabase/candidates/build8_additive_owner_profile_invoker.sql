-- NOT INSTALLED. ADDITIVE BUILD 8 STORE-COMPATIBILITY CANDIDATE; OPERATOR REVIEW ONLY.
-- An already-shipped Build 8 editor needs public.get_own_profile() but the
-- production catalog has no such endpoint. Do NOT silently run this file via
-- normal deploys: it is deliberately outside supabase/migrations.
--
-- This minimal SECURITY INVOKER endpoint cannot bypass existing RLS or column
-- ACLs. It relies on the *currently installed* authenticated-owner SELECT
-- policy and checks auth.uid() again, returning only an explicit projection.
-- No MFA helper is present on production. This is an interim compatibility
-- candidate, NOT the final Build 9 MFA/private-column boundary.
--
-- Before installing: export approved production-equivalent PG17 schemas/roles,
-- rehearse SQL + rollback in isolation, and run real signed AAL1/AAL2
-- owner/non-owner/anon read and installed iOS Build 8 edit/write regressions.
-- Preserve Build 7, all profile triggers, subscriptions, data, and policies.
-- The later reviewed Build 9 owner/MFA boundary replaces this exact return
-- signature (jsonb) and must be separately approved.
--
-- No BEGIN/COMMIT here. A versioned migration runner must wrap it atomically.
DO $compat_preflight$
BEGIN
  IF to_regprocedure('public.get_own_profile()') IS NOT NULL THEN
    RAISE EXCEPTION 'Existing owner RPC detected; do not replace or overwrite it';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid='public.profiles'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS on profiles must already be enabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
      AND cmd IN ('SELECT','ALL') AND permissive='PERMISSIVE'
      AND 'authenticated'=ANY(roles) AND qual ILIKE '%auth.uid%'
  ) THEN
    RAISE EXCEPTION 'Verified authenticated owner-SELECT policy is required';
  END IF;
  IF NOT has_table_privilege('authenticated','public.profiles','SELECT') THEN
    RAISE EXCEPTION 'Current authenticated SELECT grants required; no widening is permitted';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY['id','account_type','display_name','bio','hometown','nationality','favorite_teams','favorite_leagues','interests','experience_summary','position','height','current_country','current_team','free_agent','current_country_public','profile_visibility','first_name','last_name','years_pro','username','avatar_url','avatar_moderation_status','player_verified','player_verified_at','basketball_type','theme_preference','preferred_language','notification_preferences']::text[]) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_attribute att
      WHERE att.attrelid='public.profiles'::regclass
        AND att.attname=required.column_name
        AND att.attnum > 0 AND NOT att.attisdropped
        AND has_column_privilege('authenticated','public.profiles',required.column_name,'SELECT')
    )
  ) THEN
    RAISE EXCEPTION 'Required owner-profile columns/grants not present';
  END IF;
END
$compat_preflight$;

CREATE FUNCTION public.get_own_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $compat_read$
  SELECT jsonb_build_object(
    'id', p.id,
    'account_type', p.account_type,
    'display_name', p.display_name,
    'bio', p.bio,
    'hometown', p.hometown,
    'nationality', p.nationality,
    'favorite_teams', p.favorite_teams,
    'favorite_leagues', p.favorite_leagues,
    'interests', p.interests,
    'experience_summary', p.experience_summary,
    'position', p.position,
    'height', p.height,
    'current_country', p.current_country,
    'current_team', p.current_team,
    'free_agent', p.free_agent,
    'current_country_public', p.current_country_public,
    'profile_visibility', p.profile_visibility,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'years_pro', p.years_pro,
    'username', p.username,
    'avatar_url', p.avatar_url,
    'avatar_moderation_status', p.avatar_moderation_status,
    'player_verified', p.player_verified,
    'player_verified_at', p.player_verified_at,
    'basketball_type', p.basketball_type,
    'theme_preference', p.theme_preference,
    'preferred_language', p.preferred_language,
    'notification_preferences', p.notification_preferences
  )
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid())
    AND auth.uid() IS NOT NULL
    AND auth.jwt() ->> 'role' = 'authenticated'
    AND coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'false'
  LIMIT 1;
$compat_read$;
REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
COMMENT ON FUNCTION public.get_own_profile() IS
  'Temporary additive, invoker-RLS, JWT-owner-only installed Store Build 8 compatibility. Not the final MFA/private-column boundary.';
NOTIFY pgrst, 'reload schema';
