-- REVIEW CANDIDATE / NEVER APPLY WITHOUT REAL JWT OWNER, NONOWNER, AAL1, AAL2
-- ACCEPTANCE AND A BACKWARDS-COMPATIBLE ROLLBACK. Adds an owner-only RPC
-- but does NOT implement the broader Build 9 raw-column restriction.
-- The owner row remains subject to existing RLS; profile reader is INVOKER.
-- Scoped SECURITY DEFINER reads ONLY the caller's verified Auth factor status.
-- Do not reuse as proof of opt-in MFA for all APIs, Storage, or Realtime.
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '25s';
DO $pre$
DECLARE n bigint;
BEGIN
 IF to_regprocedure('public.get_own_profile()') IS NOT NULL
 OR to_regprocedure('hoopcheck_security.owner_profile_factor_satisfied()') IS NOT NULL
 OR to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NOT NULL
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.profiles'::regclass)
 OR to_regclass('auth.mfa_factors') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname='hoopcheck_security' AND pg_get_userbyid(n.nspowner)='postgres')
 OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='hoopcheck_security'::regnamespace
           AND has_function_privilege('authenticated',p.oid,'EXECUTE'))
 THEN RAISE EXCEPTION 'Owner profile compatibility preflight failed: protected boundary, MFA, schema/ACL drift'; END IF;
 SELECT count(*) INTO n
 FROM (VALUES
 ('public.get_public_player_profile(uuid)','d9cd27d5b6e426397674d48184530b24'),
 ('public.search_public_players(text,text,text,boolean,integer)','c2eee54d975b81dfeea139cacc2b8bee'),
 ('public.search_public_players_page(text,text,text,boolean,integer,integer)','9645a81f5e34e52e95946744ba05c9d1'),
 ('public.search_public_players_by_username(text,text,integer,integer)','5970446048bb69b39ebf46c911bea8ac'),
 ('public.is_player_country_public(uuid)','1040aa769cb9e51a51c40b5bdd14ee6b')
 ) v(signature,fingerprint)
 JOIN pg_proc p ON p.oid=to_regprocedure(v.signature)
 WHERE md5(p.prosrc)=v.fingerprint AND NOT p.prosecdef;
 IF n<>5 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261122040018')
 THEN RAISE EXCEPTION 'Legacy Build8 privacy/compatibility baseline changed; abort owner RPC migration'; END IF;
END $pre$;

-- BEGIN ISOLATABLE OWNER RPC CONTRACT
-- The schema pre-exists; no grants or ACLs on existing functions are widened.
GRANT USAGE ON SCHEMA hoopcheck_security TO authenticated;

CREATE FUNCTION hoopcheck_security.owner_profile_factor_satisfied()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $factor$
 SELECT auth.uid() IS NOT NULL
  AND auth.jwt()->>'role' = 'authenticated'
  AND coalesce(auth.jwt()->>'is_anonymous','false') = 'false'
  AND (
    auth.jwt()->>'aal' = 'aal2'
    OR (coalesce(auth.jwt()->>'aal','aal1')='aal1'
        AND NOT EXISTS(SELECT 1 FROM auth.mfa_factors f
                       WHERE f.user_id = auth.uid()
                         AND f.status = 'verified'))
  );
$factor$;
REVOKE ALL ON FUNCTION hoopcheck_security.owner_profile_factor_satisfied() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hoopcheck_security.owner_profile_factor_satisfied() TO authenticated;

CREATE FUNCTION public.get_own_profile()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $profile$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL
   OR auth.jwt()->>'role' IS DISTINCT FROM 'authenticated'
   OR coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
   OR NOT coalesce(hoopcheck_security.owner_profile_factor_satisfied(),false)
 THEN RAISE EXCEPTION 'Verified owner session required'
        USING ERRCODE='42501',HINT='mfa_required';
 END IF;
 SELECT jsonb_build_object(
    'id',p.id,
    'account_type',p.account_type,
    'display_name',p.display_name,
    'bio',p.bio,
    'username',p.username,
    'first_name',p.first_name,
    'last_name',p.last_name,
    'years_pro',p.years_pro,
    'current_country',p.current_country,
    'current_country_public',p.current_country_public,
    'position',p.position,
    'height',p.height,
    'free_agent',p.free_agent,
    'current_team',p.current_team,
    'profile_visibility',p.profile_visibility,
    'hometown',p.hometown,
    'nationality',p.nationality,
    'interests',p.interests,
    'favorite_leagues',p.favorite_leagues,
    'favorite_teams',p.favorite_teams,
    'experience_summary',p.experience_summary,
    'avatar_url',p.avatar_url,
    'avatar_moderation_status',p.avatar_moderation_status,
    'player_verified',p.player_verified,
    'player_verified_at',p.player_verified_at,
    'created_at',p.created_at,
    'updated_at',p.updated_at,
    'is_adult',p.is_adult,
    'agreed_to_terms',p.agreed_to_terms,
    'moderation_status',p.moderation_status,
    'notification_preferences',p.notification_preferences
 ) INTO result
 FROM public.profiles p
 WHERE p.id = auth.uid();
 RETURN result;
END;
$profile$;
REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
-- END ISOLATABLE OWNER RPC CONTRACT

DO $post$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.get_own_profile()'::regprocedure
    AND NOT p.prosecdef AND p.provolatile='s' AND p.proconfig=ARRAY['search_path=']::text[]
    AND pg_get_userbyid(p.proowner)='postgres'
    AND has_function_privilege('authenticated',p.oid,'EXECUTE') )
 OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='hoopcheck_security.owner_profile_factor_satisfied()'::regprocedure
    AND p.prosecdef AND p.provolatile='s' AND p.proconfig=ARRAY['search_path=']::text[]
    AND pg_get_userbyid(p.proowner)='postgres')
 OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) acl
    WHERE p.oid IN ('public.get_own_profile()'::regprocedure,'hoopcheck_security.owner_profile_factor_satisfied()'::regprocedure)
    AND acl.grantee=0 AND acl.privilege_type='EXECUTE')
 THEN RAISE EXCEPTION 'Scoped owner RPC ACL/security postcondition failed'; END IF;
END $post$;
NOTIFY pgrst,'reload schema';
