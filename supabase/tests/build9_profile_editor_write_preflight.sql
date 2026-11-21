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
  IF NOT has_column_privilege('authenticated','public.profiles','display_name','UPDATE') THEN
    RAISE EXCEPTION 'Missing authenticated display_name UPDATE grant';
  END IF;
  IF NOT has_column_privilege('authenticated','public.profiles','current_country','UPDATE') THEN
    RAISE EXCEPTION 'Missing authenticated current_country UPDATE grant';
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
