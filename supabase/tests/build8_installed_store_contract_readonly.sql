-- HoopCheck Build 9 release: installed iOS Store Build 8 (0.2.0/8) API metadata audit.
-- Source: EAS Build f0dd9cd3-cee2-49a7-b541-5485144f377e
-- Exact source SHA: c0b77ba3e7de5beb88cd588a8cfe506bec315e2b
-- This is a read-only PostgreSQL catalog inventory; NOT a migration or JWT acceptance.
-- Do not query customer rows, identities, invoices, secrets, or make any writes.
BEGIN TRANSACTION READ ONLY;

WITH expected_rpc(contract, signature) AS (
  VALUES
    ('native_owner_editor', 'public.get_own_profile()'),
    ('native_public_player', 'public.get_public_player_profile(uuid)'),
    ('native_username_search', 'public.search_public_players_by_username(text,text,integer,integer)'),
    ('native_country_consent', 'public.is_player_country_public(uuid)'),
    ('native_chat_room_guard', 'public.fan_live_chat_room_open(uuid)')
), installed_rpc AS (
  SELECT e.contract, e.signature, p.oid, p.proowner, p.prosecdef, p.pronargdefaults
  FROM expected_rpc e
  LEFT JOIN pg_catalog.pg_proc p ON p.oid = to_regprocedure(e.signature)
), expected_update(column_name) AS (
  VALUES
    ('display_name'), ('bio'), ('hometown'), ('nationality'),
    ('favorite_teams'), ('favorite_leagues'), ('interests'),
    ('experience_summary'), ('position'), ('height'),
    ('current_country'), ('current_team'), ('free_agent'),
    ('current_country_public'), ('profile_visibility')
), results AS (
  SELECT 'rpc'::text AS contract_type, contract,
    (oid IS NOT NULL) AS installed,
    CASE WHEN oid IS NOT NULL THEN has_function_privilege('anon',oid,'EXECUTE') END AS anon_permitted,
    CASE WHEN oid IS NOT NULL THEN has_function_privilege('authenticated',oid,'EXECUTE') END AS authenticated_permitted,
    CASE WHEN oid IS NOT NULL THEN format('owner=%s; security_definer=%s; optional_args=%s',
      pg_get_userbyid(proowner),prosecdef,pronargdefaults) ELSE 'missing function' END AS detail
  FROM installed_rpc
  UNION ALL
  SELECT 'editor_update_column', e.column_name,
    EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid=to_regclass('public.profiles')
      AND a.attname=e.column_name AND NOT a.attisdropped),
    has_column_privilege('anon','public.profiles',e.column_name,'UPDATE'),
    has_column_privilege('authenticated','public.profiles',e.column_name,'UPDATE'),
    'Build 8 PATCH profiles UPDATE; actual ownership/RLS/trigger behavior requires signed HTTP tests'
  FROM expected_update e
  UNION ALL
  SELECT 'privacy_risk', 'raw_current_country_select', true,
    has_column_privilege('anon','public.profiles','current_country','SELECT'),
    has_column_privilege('authenticated','public.profiles','current_country','SELECT'),
    'True indicates raw country SELECT is still exposed; changing this requires legacy client rehearsal'
  UNION ALL
  SELECT 'rls', 'profiles_rls_enabled', true,
    NULL::boolean, (SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid=to_regclass('public.profiles')),
    'Profiles table must keep RLS; this metadata does not prove policy behavior'
)
SELECT * FROM results ORDER BY contract_type, contract;
ROLLBACK;
