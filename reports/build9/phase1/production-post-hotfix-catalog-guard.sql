-- HoopCheck Build 9 Phase 1: captured POST-hotfix production catalog guard (2026-11-22).
-- Read-only. Not a migration, not release acceptance, not a substitute for signed JWT
-- testing or Build 7/8 installed-client compatibility. NEVER run against PR17-Test.
-- Preserve the original pre-hotfix guard as historical evidence; do not update its hashes.
-- If this guard fails, halt and review real catalog changes instead of weakening checks.
BEGIN TRANSACTION READ ONLY;
DO $post_hotfix_guard$
DECLARE drift text;
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'Catalog guard must run in a read-only transaction';
  END IF;
  IF to_regclass('public.profiles') IS NULL
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.profiles'::regclass)
     OR to_regclass('public.follow_relationships') IS NULL
     OR to_regclass('public.user_blocks') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM supabase_migrations.schema_migrations
       WHERE version='20261122032844'
     )
  THEN
    RAISE EXCEPTION 'Missing Phase 1 hotfix migration, profile RLS, or production follow/block prerequisites';
  END IF;

  SELECT string_agg(v.signature, ', ' ORDER BY v.signature) INTO drift
  FROM (VALUES
    ('public.get_public_player_profile(uuid)', 'd9cd27d5b6e426397674d48184530b24'),
    ('public.search_public_players(text,text,text,boolean,integer)', 'c2eee54d975b81dfeea139cacc2b8bee'),
    ('public.search_public_players_page(text,text,text,boolean,integer,integer)', '9645a81f5e34e52e95946744ba05c9d1')
  ) AS v(signature, source_md5)
  LEFT JOIN pg_proc p ON p.oid=to_regprocedure(v.signature)
  WHERE p.oid IS NULL
    OR pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres'
    OR p.prosecdef IS DISTINCT FROM false
    OR p.provolatile IS DISTINCT FROM 's'
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
    OR md5(p.prosrc) IS DISTINCT FROM v.source_md5
    OR NOT has_function_privilege('anon', p.oid, 'EXECUTE')
    OR NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
    OR EXISTS (
      SELECT 1 FROM aclexplode(p.proacl) acl
      WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE'
    );
  IF drift IS NOT NULL THEN
    RAISE EXCEPTION 'Post-hotfix production RPC drift: %; stop and re-review', drift;
  END IF;

  IF to_regprocedure('public.get_own_profile()') IS NOT NULL
     OR to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NOT NULL
     OR to_regprocedure('public.search_public_players_by_username(text,text,integer,integer)') IS NOT NULL
  THEN
    RAISE EXCEPTION 'Production owner/MFA/profile API advanced beyond the reviewed Phase 1 baseline';
  END IF;
  IF NOT has_column_privilege('anon','public.profiles','current_country','SELECT')
     OR NOT has_column_privilege('authenticated','public.profiles','current_country','SELECT')
  THEN
    RAISE EXCEPTION 'Raw country grants changed: re-review installed-client and privacy rollout';
  END IF;
  RAISE NOTICE 'PASS: Phase 1 RPC masking identity preserved; direct raw-country grants remain; real JWT / legacy-client gates UNVERIFIED';
END $post_hotfix_guard$;
SELECT 'PASS_POST_HOTFIX_IDENTITY_ONLY' AS gate,
 (SELECT count(*) FROM supabase_migrations.schema_migrations) AS recorded_migrations,
 has_column_privilege('anon','public.profiles','current_country','SELECT') AS anon_raw_country_grant,
 has_column_privilege('authenticated','public.profiles','current_country','SELECT') AS authenticated_raw_country_grant;
ROLLBACK;
