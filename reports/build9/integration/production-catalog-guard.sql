-- HoopCheck Build 9: READ-ONLY production RPC catalog identity guard.
-- NOT a migration, NOT a release approval, and NOT a complete schema export.
-- Intended only for owner-confirmed production project ucbdceaieyenljcwlhnj.
-- Run via psql -X -v ON_ERROR_STOP=1 after independently verifying the project.
-- A stale baseline MUST cause failure; do not change the expected fingerprints
-- simply to make a failing production deployment pass.
-- 2026-11-22 phase-1 legacy RPC masking installed by production migration
-- 20261122032844 (PR #789); two SECURITY INVOKER Build8 public RPCs installed
-- in 20261122040018 (#802). Raw table SELECT grants remain unchanged.
-- Source hashes were captured after the successful atomic migration and
-- verified with anonymous read-only smoke tests. This is NOT phase-2 approval.
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
       'd9cd27d5b6e426397674d48184530b24', false, 'search_path=public'),
    ('public.search_public_players(text,text,text,boolean,integer)',
       'c2eee54d975b81dfeea139cacc2b8bee', false, 'search_path=public'),
    ('public.search_public_players_page(text,text,text,boolean,integer,integer)',
       '9645a81f5e34e52e95946744ba05c9d1', false, 'search_path=public'),
    ('public.search_public_players_by_username(text,text,integer,integer)',
       '5970446048bb69b39ebf46c911bea8ac', false, 'search_path=public'),
    ('public.is_player_country_public(uuid)',
       '1040aa769cb9e51a51c40b5bdd14ee6b', false, 'search_path=public'),
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
     OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE');

  IF changed IS NOT NULL THEN
    RAISE EXCEPTION 'Production function drift detected; stop and re-review: %', changed;
  END IF;

  IF to_regprocedure('public.get_own_profile()') IS NOT NULL
     OR to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NOT NULL
  THEN
    RAISE EXCEPTION 'Owner/MFA security boundary advanced beyond captured baseline; re-review before rollout';
  END IF;
  IF to_regprocedure('public.search_public_players_by_username(text,text,integer,integer)') IS NULL
     OR to_regprocedure('public.is_player_country_public(uuid)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261122040018')
  THEN
    RAISE EXCEPTION 'Build 8 public RPC compatibility migration missing; release HOLD';
  END IF;

  IF NOT has_column_privilege('anon','public.profiles','current_country','SELECT')
     OR NOT has_column_privilege('authenticated','public.profiles','current_country','SELECT')
  THEN
    RAISE EXCEPTION 'Raw country access has changed; re-review privacy transition and old clients';
  END IF;

  RAISE NOTICE 'PASS: Phase1 masked legacy + Build8 public RPCs installed; raw direct-column access and owner/MFA phase2 are NOT approved';
END $catalog$;
ROLLBACK;
