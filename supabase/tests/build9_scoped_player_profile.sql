\set ON_ERROR_STOP on
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN CREATE ROLE authenticator; END IF;
END $$;
CREATE ROLE hoopcheck_public_profile_reader NOLOGIN NOBYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid; $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE TABLE auth.mfa_factors(user_id uuid, status text);
CREATE TABLE public.profiles(
  id uuid PRIMARY KEY, display_name text, avatar_url text, country text, bio text, position text,
  years_pro integer, current_country text, current_team text, player_verified boolean,
  player_verified_at timestamptz, avatar_moderation_status text, current_country_public boolean,
  account_type text, profile_visibility text, moderation_status text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_public_profile_rpc_reader ON public.profiles FOR SELECT
  TO hoopcheck_public_profile_reader USING (
    account_type = 'player' AND profile_visibility IN ('public','players_only')
    AND (moderation_status IS NULL OR moderation_status <> 'suspended')
  );
GRANT USAGE ON SCHEMA public TO hoopcheck_public_profile_reader;
GRANT SELECT (id, display_name, avatar_url, country, bio, position, years_pro, current_country, current_team,
  player_verified, player_verified_at, avatar_moderation_status, current_country_public,
  account_type, profile_visibility, moderation_status) ON public.profiles TO hoopcheck_public_profile_reader;

CREATE FUNCTION public.profile_rpc_caller_uid()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid();
$$;
REVOKE ALL ON FUNCTION public.profile_rpc_caller_uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_rpc_caller_uid() TO hoopcheck_public_profile_reader, service_role;

-- Original hosted prosrc, retained verbatim to exercise the fingerprint.
CREATE FUNCTION public.get_public_player_profile(p_user_id uuid)
RETURNS TABLE(id uuid, display_name text, avatar_url text, country text, bio text, player_position text,
  years_pro integer, current_country text, current_team text, player_verified boolean, player_verified_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$ SELECT p.id,p.display_name,CASE WHEN coalesce(p.avatar_moderation_status,'approved')='approved' THEN p.avatar_url ELSE NULL END,p.country,p.bio,p.position,p.years_pro,CASE WHEN p.current_country_public IS TRUE THEN p.current_country ELSE NULL END,p.current_team,p.player_verified,p.player_verified_at FROM public.profiles p WHERE p.id=p_user_id AND p.account_type='player' AND (p.profile_visibility='public' OR (p.profile_visibility='players_only' AND EXISTS(SELECT 1 FROM public.profiles viewer WHERE viewer.id=public.profile_rpc_caller_uid() AND viewer.account_type='player'))) AND (p.moderation_status IS NULL OR p.moderation_status<>'suspended'); $function$;
ALTER FUNCTION public.get_public_player_profile(uuid) OWNER TO hoopcheck_public_profile_reader;
REVOKE ALL ON FUNCTION public.get_public_player_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_player_profile(uuid) TO service_role, anon, authenticated;

\ir ../migrations/20261118162456_opted_in_mfa_enforcement.sql
\ir ../candidates/20261121103148_reconcile_scoped_public_player_profile.sql
\ir ../candidates/20261121103148_reconcile_scoped_public_player_profile.sql

INSERT INTO public.profiles(id, display_name, avatar_url, current_country, avatar_moderation_status,
  current_country_public, account_type, profile_visibility, moderation_status) VALUES
  ('11111111-1111-4111-8111-111111111111','Owner','fixture-rejected','Private country','pending',false,'player','public','normal'),
  ('22222222-2222-4222-8222-222222222222','Player','fixture-approved','Public country','approved',true,'player','players_only','normal'),
  ('33333333-3333-4333-8333-333333333333','Suspended',null,null,null,true,'player','public','suspended'),
  ('44444444-4444-4444-8444-444444444444','Fan',null,null,null,true,'fan','public','normal'),
  ('55555555-5555-4555-8555-555555555555','Private',null,null,null,true,'player','private','normal');
INSERT INTO auth.mfa_factors VALUES ('11111111-1111-4111-8111-111111111111', 'verified');

SET LOCAL ROLE anon;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM public.get_public_player_profile('11111111-1111-4111-8111-111111111111')
    WHERE current_country IS NULL AND avatar_url IS NULL)
    OR EXISTS (SELECT FROM public.get_public_player_profile('22222222-2222-4222-8222-222222222222'))
    OR EXISTS (SELECT FROM public.get_public_player_profile('33333333-3333-4333-8333-333333333333'))
    OR EXISTS (SELECT FROM public.get_public_player_profile('55555555-5555-4555-8555-555555555555'))
  THEN RAISE EXCEPTION 'Anonymous detail privacy or availability changed'; END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","aal":"aal1","sub":"11111111-1111-4111-8111-111111111111"}', true);
DO $$ BEGIN
  IF EXISTS (SELECT FROM public.get_public_player_profile('11111111-1111-4111-8111-111111111111'))
    OR EXISTS (SELECT FROM hoopcheck_security.player_profile('22222222-2222-4222-8222-222222222222'))
  THEN RAISE EXCEPTION 'Enrolled AAL1 caller bypassed MFA'; END IF;
END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","aal":"aal2","sub":"11111111-1111-4111-8111-111111111111"}', true);
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM public.get_public_player_profile('11111111-1111-4111-8111-111111111111')
    WHERE current_country IS NULL AND avatar_url IS NULL)
    OR NOT EXISTS (SELECT FROM hoopcheck_security.player_profile('22222222-2222-4222-8222-222222222222')
    WHERE current_country = 'Public country' AND avatar_url = 'fixture-approved')
  THEN RAISE EXCEPTION 'AAL2 owner masking or players-only visibility failed'; END IF;
END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","aal":"aal1","is_anonymous":true,"sub":"22222222-2222-4222-8222-222222222222"}', true);
DO $$ BEGIN
  IF EXISTS (SELECT FROM public.get_public_player_profile('22222222-2222-4222-8222-222222222222'))
  THEN RAISE EXCEPTION 'Anonymous Auth player bypassed the players-only gate'; END IF;
END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","aal":"aal1","sub":"44444444-4444-4444-8444-444444444444"}', true);
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM public.get_public_player_profile('11111111-1111-4111-8111-111111111111')
    WHERE current_country IS NULL AND avatar_url IS NULL)
    OR EXISTS (SELECT FROM public.get_public_player_profile('22222222-2222-4222-8222-222222222222'))
  THEN RAISE EXCEPTION 'Non-owner AAL1 viewer did not honor masking or players-only access'; END IF;
END $$;

ROLLBACK;
