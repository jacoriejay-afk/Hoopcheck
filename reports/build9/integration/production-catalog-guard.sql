-- HoopCheck Build 9: READ-ONLY production RPC catalog identity guard.
-- NOT a migration, NOT a release approval, and NOT a complete schema export.
-- Intended only for owner-confirmed production project ucbdceaieyenljcwlhnj.
-- Run via psql -X -v ON_ERROR_STOP=1 after independently verifying the project.
-- A stale baseline MUST cause failure; do not change the expected fingerprints
-- simply to make a failing production deployment pass.
BEGIN TRANSACTION READ ONLY;
DO $catalog$
DECLARE
  changed text;
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.profiles'::regclass)
     OR to_regclass('public.follow_relationships') IS NULL
     OR to_regclass('public.user_blocks') IS NULL
  THEN
    RAISE EXCEPTION 'Different installed production contract: profile RLS or follow/block prerequisites missing';
  END IF;

  SELECT string_agg(v.signature, ', ' ORDER BY v.signature)
  INTO changed
  FROM (VALUES
    ('public.get_public_player_profile(uuid)',
       '5d7ea9682e0f549b359888c019a657bb', false, 'search_path=public'),
    ('public.search_public_players(text,text,text,boolean,integer)',
       '378505e5bc40299370a991d17058a095', false, 'search_path=public'),
    ('public.search_public_players_page(text,text,text,boolean,integer,integer)',
       '0b35b8188a6a26fb457b6cca1295a93e', false, 'search_path=public'),
    ('public.get_public_follow_list(text,text,uuid,uuid)',
       '557d85a6abf873e47ffc1f4ae283debd', true, 'search_path=""')
  ) AS v(signature, source_md5, expected_definer, expected_search_path)
  LEFT JOIN pg_proc p ON p.oid = to_regprocedure(v.signature)
  WHERE p.oid IS NULL OR pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres'
     OR p.prosecdef IS DISTINCT FROM v.expected_definer
     OR p.provolatile IS DISTINCT FROM 's'
     OR md5(p.prosrc) IS DISTINCT FROM v.source_md5
     OR p.proconfig IS DISTINCT FROM ARRAY[v.expected_search_path]::text[]
     OR NOT has_function_privilege('anon',p.oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
     OR has_function_privilege('public',p.oid,'EXECUTE');

  IF changed IS NOT NULL THEN
    RAISE EXCEPTION 'Production function drift detected; stop and re-review: %', changed;
  END IF;

  IF to_regprocedure('public.get_own_profile()') IS NOT NULL
     OR to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NOT NULL
     OR to_regprocedure('public.search_public_players_by_username(text,text,integer,integer)') IS NOT NULL
     OR to_regprocedure('public.is_player_country_public(uuid)') IS NOT NULL
  THEN
    RAISE EXCEPTION 'Production advanced beyond the captured Build 9 baseline; re-review before any rollout';
  END IF;

  IF NOT has_column_privilege('anon','public.profiles','current_country','SELECT')
     OR NOT has_column_privilege('authenticated','public.profiles','current_country','SELECT')
  THEN
    RAISE EXCEPTION 'Raw country access has changed; re-review privacy transition and old clients';
  END IF;

  RAISE NOTICE 'PASS: captured production RPC baseline matches; privacy migration is still NOT applied or approved';
END $catalog$;
ROLLBACK;
