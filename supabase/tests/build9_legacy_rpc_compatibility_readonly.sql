-- HoopCheck Build 9 / 2026-11-23: Build 7/8/9 RPC compatibility INVENTORY ONLY.
-- No user rows, JWTs, keys, function bodies, writes, DDL, role changes or grants.
-- Run this identical file on production and a disposable production-schema-equivalent
-- PostgreSQL 17 rehearsal. Results are metadata, not signed-user acceptance.
-- A difference or even a match here does NOT authorize a production migration.
BEGIN TRANSACTION READ ONLY;

WITH expected(label, signature, required_for) AS (
  VALUES
    ('legacy_player_detail', 'public.get_public_player_profile(uuid)', 'Build7/8'),
    ('legacy_player_search', 'public.search_public_players(text,text,text,boolean,integer)', 'Build7/8'),
    ('legacy_player_search_page', 'public.search_public_players_page(text,text,text,boolean,integer,integer)', 'Build7/8'),
    ('username_search', 'public.search_public_players_by_username(text,text,integer,integer)', 'Build8'),
    ('country_consent', 'public.is_player_country_public(uuid)', 'Build8'),
    ('owner_profile', 'public.get_own_profile()', 'Build9'),
    ('postgame_server_guard', 'public.fan_live_chat_room_open(uuid)', 'Build9'),
    ('mfa_satisfied', 'hoopcheck_security.mfa_satisfied()', 'Build9')
), installed AS (
  SELECT e.*, p.oid, p.proowner, p.prosecdef, p.proconfig, p.proacl,
         p.pronargdefaults,
         CASE WHEN p.oid IS NULL THEN NULL ELSE pg_get_function_arguments(p.oid) END AS arguments,
         CASE WHEN p.oid IS NULL THEN NULL ELSE md5(p.prosrc) END AS source_digest
  FROM expected e
  LEFT JOIN pg_proc p ON p.oid = to_regprocedure(e.signature)
)
SELECT label, required_for, signature, (oid IS NOT NULL) AS installed,
       CASE WHEN oid IS NOT NULL THEN pg_get_userbyid(proowner) END AS function_owner,
       CASE WHEN oid IS NOT NULL THEN prosecdef END AS security_definer,
       arguments, pronargdefaults AS optional_arg_count, proconfig AS settings,
       source_digest,
       CASE WHEN oid IS NOT NULL THEN has_function_privilege('anon', oid, 'EXECUTE') END AS anon_execute,
       CASE WHEN oid IS NOT NULL THEN has_function_privilege('authenticated', oid, 'EXECUTE') END AS auth_execute,
       CASE WHEN oid IS NOT NULL THEN EXISTS (
         SELECT 1 FROM aclexplode(COALESCE(proacl, acldefault('f', proowner))) a
         WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
       ) END AS public_execute
FROM installed
ORDER BY label;

ROLLBACK;
