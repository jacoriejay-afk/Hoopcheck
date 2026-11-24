-- Scoped-owner reconciliation for the catalog observed on HoopCheck-PR17-Test.
-- Run in one transaction using an existing authorized migration identity.
-- Keep this outside automatic migration discovery until hosted acceptance.
DO $migration$
DECLARE
  installed record;
  reader oid := to_regrole('hoopcheck_public_profile_reader');
  replacement text := $body$
    SELECT p.id, p.display_name,
      CASE WHEN coalesce(p.avatar_moderation_status, 'approved') = 'approved' THEN p.avatar_url END,
      p.country, p.bio, p.position, p.years_pro,
      CASE WHEN p.current_country_public IS TRUE THEN p.current_country END,
      p.current_team, p.player_verified, p.player_verified_at
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.account_type = 'player'
      AND (
        p.profile_visibility = 'public'
        OR (
          p.profile_visibility = 'players_only'
          AND coalesce(nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb->>'is_anonymous', 'false') = 'false'
          AND EXISTS (
            SELECT 1 FROM public.profiles viewer
            WHERE viewer.id = public.profile_rpc_caller_uid() AND viewer.account_type = 'player'
          )
        )
      )
      AND (p.moderation_status IS NULL OR p.moderation_status <> 'suspended')
      AND coalesce(hoopcheck_security.mfa_satisfied(), false);
$body$;
BEGIN
  SELECT p.* INTO installed FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.get_public_player_profile(uuid)');

  IF installed.oid IS NULL OR reader IS NULL OR installed.proowner <> reader
     OR NOT installed.prosecdef OR installed.provolatile <> 's'
     OR installed.prolang <> (SELECT oid FROM pg_language WHERE lanname = 'sql')
     OR installed.proconfig IS DISTINCT FROM ARRAY['search_path=""']
     OR pg_get_function_identity_arguments(installed.oid) <> 'p_user_id uuid'
     OR pg_get_function_result(installed.oid) <> 'TABLE(id uuid, display_name text, avatar_url text, country text, bio text, player_position text, years_pro integer, current_country text, current_team text, player_verified boolean, player_verified_at timestamp with time zone)'
     OR (md5(installed.prosrc) <> 'fc0819fe475426dac91bc4f3a8a664a9' AND installed.prosrc <> replacement)
     OR (SELECT array_agg(grantee::regrole::text ORDER BY grantee::regrole::text)
         FROM aclexplode(installed.proacl)
         WHERE privilege_type = 'EXECUTE' AND grantor = reader AND NOT is_grantable)
          IS DISTINCT FROM ARRAY['anon', 'authenticated', 'hoopcheck_public_profile_reader', 'service_role']
     OR (SELECT count(*) FROM aclexplode(installed.proacl)) <> 4
  THEN
    RAISE EXCEPTION 'Scoped profile RPC differs from the reviewed definition or ACL';
  END IF;

  IF NOT pg_has_role(current_user, reader, 'USAGE')
     OR NOT has_schema_privilege(current_user, 'public', 'CREATE') THEN
    RAISE EXCEPTION 'Scoped profile reconciliation requires an existing authorized function-owner migration identity'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT FROM pg_roles WHERE oid = reader AND (rolsuper OR rolcanlogin OR rolbypassrls))
     OR EXISTS (SELECT FROM pg_class WHERE oid = 'public.profiles'::regclass
       AND (NOT relrowsecurity OR pg_has_role(reader, relowner, 'USAGE')))
     OR has_table_privilege(reader, 'public.profiles', 'SELECT')
     OR NOT has_function_privilege(reader, 'public.profile_rpc_caller_uid()', 'EXECUTE')
     OR to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NULL THEN
    RAISE EXCEPTION 'Scoped reader, profile RLS or MFA prerequisites differ from the reviewed contract';
  END IF;

  -- The reader gets only the existing boolean caller-MFA contract.
  GRANT USAGE ON SCHEMA hoopcheck_security TO hoopcheck_public_profile_reader;
  GRANT EXECUTE ON FUNCTION hoopcheck_security.mfa_satisfied() TO hoopcheck_public_profile_reader;

  EXECUTE format($ddl$
    CREATE OR REPLACE FUNCTION public.get_public_player_profile(p_user_id uuid)
    RETURNS TABLE(id uuid, display_name text, avatar_url text, country text, bio text,
      player_position text, years_pro integer, current_country text, current_team text,
      player_verified boolean, player_verified_at timestamptz)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS %L
  $ddl$, replacement);

  IF NOT EXISTS (
    SELECT FROM pg_proc p WHERE p.oid = installed.oid AND p.proowner = reader
      AND p.proacl IS NOT DISTINCT FROM installed.proacl AND p.prosecdef
      AND p.proconfig = ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION 'Scoped profile RPC identity, ACL or execution context changed';
  END IF;
END;
$migration$;
-- Consent must use the same eligibility as the installed scoped detail API.
CREATE OR REPLACE FUNCTION hoopcheck_security.player_profile(p_user_id uuid)
RETURNS TABLE(id uuid, display_name text, avatar_url text, country text, bio text,
  player_position text, years_pro integer, current_country text, current_team text,
  player_verified boolean, player_verified_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public.get_public_player_profile(p_user_id);
$$;
REVOKE ALL ON FUNCTION hoopcheck_security.player_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hoopcheck_security.player_profile(uuid) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
