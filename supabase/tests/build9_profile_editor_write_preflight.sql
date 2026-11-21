-- Build 9 profile-editor least-privilege preflight (isolated test DB only).
-- Run after applying reviewed profile editor grants/RLS to staging.
-- Fail closed on missing grants or unsafe policies; does not mutate rows.
BEGIN;
DO $$
DECLARE
  update_policies integer;
BEGIN
  IF NOT has_column_privilege('authenticated','public.profiles','id','SELECT') THEN
    RAISE EXCEPTION 'Editor UPDATE RETURNING id requires id SELECT';
  END IF;
  -- Exact fields used by apps/mobile/src/native/profileEditor.ts saveOwnProfile().
  -- Column UPDATE privileges alone do not establish JWT ownership or MFA.
  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY[
      'display_name','bio','hometown','nationality','favorite_teams',
      'favorite_leagues','interests','experience_summary','position','height',
      'current_country','current_team','free_agent','current_country_public',
      'profile_visibility'
    ]::text[]) AS field(name)
    WHERE NOT has_column_privilege('authenticated','public.profiles',field.name,'UPDATE')
  ) THEN
    RAISE EXCEPTION 'Missing one or more native profile editor column UPDATE grants';
  END IF;
  IF has_column_privilege('authenticated','public.profiles','moderation_note','UPDATE') THEN
    RAISE EXCEPTION 'Unsafe authenticated moderation_note UPDATE grant';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.profiles'::regclass) THEN
    RAISE EXCEPTION 'Profile RLS disabled';
  END IF;
  SELECT count(*) INTO update_policies
    FROM pg_policies
   WHERE schemaname='public' AND tablename='profiles'
     AND cmd IN ('UPDATE','ALL')
     AND ('authenticated'=ANY(roles) OR 'public'=ANY(roles));
  IF update_policies=0 THEN
    RAISE EXCEPTION 'No authenticated profile UPDATE RLS policy';
  END IF;
  RAISE NOTICE 'Static grants and RLS preflight passed; owner/non-owner JWT runtime tests still required';
END $$;
ROLLBACK;
