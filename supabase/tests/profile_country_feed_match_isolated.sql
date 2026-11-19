-- Isolated synthetic prototype for country equality used in HoopFeed authorization.
-- NOT a production migration; run only in a disposable PostgreSQL database.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;
CREATE TABLE public.profiles (
 id uuid PRIMARY KEY, account_type text, profile_visibility text,
 current_country text, current_country_public boolean
);
INSERT INTO public.profiles VALUES
 ('11111111-1111-4111-8111-111111111111','player','public','Hidden Country',false),
 ('22222222-2222-4222-8222-222222222222','player','public','Hidden Country',false),
 ('33333333-3333-4333-8333-333333333333','player','public','Other Country',false),
 ('44444444-4444-4444-8444-444444444444','fan','public','Hidden Country',false),
 ('55555555-5555-4555-8555-555555555555','player','public',null,false);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_read ON public.profiles FOR SELECT TO anon USING(profile_visibility='public');
CREATE POLICY authenticated_read ON public.profiles FOR SELECT TO authenticated USING(profile_visibility='public' OR id=auth.uid());
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT(id,account_type,profile_visibility,current_country_public) ON public.profiles TO anon,authenticated;
-- Returns only equality; caller must be an authenticated player and first ID must
-- be the actual viewer. This predicate does not grant feed access by itself.
CREATE OR REPLACE FUNCTION public.is_my_player_country_match(p_author_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.profiles viewer
  JOIN public.profiles author ON author.id=p_author_id
  WHERE viewer.id=(SELECT auth.uid())
    AND viewer.account_type='player'
    AND author.account_type='player'
    AND viewer.current_country IS NOT NULL
    AND author.current_country IS NOT NULL
    AND lower(viewer.current_country)=lower(author.current_country)
 )
$$;
REVOKE ALL ON FUNCTION public.is_my_player_country_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_my_player_country_match(uuid) TO authenticated;
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF has_function_privilege('anon','public.is_my_player_country_match(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'anonymous user may execute private comparison';
 END IF;
 IF has_column_privilege('anon','public.profiles','current_country','SELECT') THEN
  RAISE EXCEPTION 'anonymous user can read country column';
 END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF public.is_my_player_country_match('22222222-2222-4222-8222-222222222222') IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'same private country should match';
 END IF;
 IF public.is_my_player_country_match('33333333-3333-4333-8333-333333333333') IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'different private country should not match';
 END IF;
 IF public.is_my_player_country_match('55555555-5555-4555-8555-555555555555') IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'null country should not match';
 END IF;
 IF has_column_privilege('authenticated','public.profiles','current_country','SELECT') THEN
  RAISE EXCEPTION 'authenticated user can read raw country column';
 END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
DO $$ BEGIN
 IF public.is_my_player_country_match('22222222-2222-4222-8222-222222222222') IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'fan must not use player country match';
 END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: isolated private-country equality decision without raw-column SELECT grants' AS result;
