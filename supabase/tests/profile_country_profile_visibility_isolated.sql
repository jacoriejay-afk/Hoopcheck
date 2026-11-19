-- Isolated visibility contract for a definer-backed public player reader.
-- This fixture is a contract test, not the full production schema.
\set ON_ERROR_STOP on
BEGIN;
DO $roles$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $roles$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $uid$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$uid$;
CREATE TABLE public.profiles(
 id uuid PRIMARY KEY,account_type text,profile_visibility text,
 moderation_status text,avatar_moderation_status text,avatar_url text,
 display_name text,country text,bio text,position text,years_pro integer,
 current_country text,current_country_public boolean,current_team text,
 player_verified boolean,player_verified_at timestamptz,
 username text,free_agent boolean,basketball_type text
);
INSERT INTO public.profiles(id,account_type,profile_visibility,moderation_status,display_name,current_country,current_country_public)
VALUES
 ('00000000-0000-0000-0000-000000000001','player','public','active','Public hidden','SECRET',false),
 ('00000000-0000-0000-0000-000000000002','player','public','active','Public shared','VISIBLE',true),
 ('00000000-0000-0000-0000-000000000003','player','players_only','active','Players only','PRIVATE',false),
 ('00000000-0000-0000-0000-000000000004','player','public','suspended','Suspended','SUSPENDED',true),
 ('00000000-0000-0000-0000-000000000005','fan','public','active','Fan','FAN',true),
 ('00000000-0000-0000-0000-000000000006','player','public','active','Viewer','VIEWER',false);
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT(id,account_type,profile_visibility,moderation_status,display_name,current_country_public) ON public.profiles TO anon,authenticated;
-- Execute the real candidate function bodies, followed by the actual definer migration.
\i supabase/migrations/20261118162305_player_profile_country_privacy.sql
\i supabase/migrations/20261119170000_protected_player_directory_country.sql
SET LOCAL ROLE anon;
DO $anon$ BEGIN
 IF (SELECT current_country FROM public.get_public_player_profile('00000000-0000-0000-0000-000000000001')) IS NOT NULL THEN RAISE EXCEPTION 'anon saw hidden country'; END IF;
 IF (SELECT current_country FROM public.get_public_player_profile('00000000-0000-0000-0000-000000000002')) IS DISTINCT FROM 'VISIBLE' THEN RAISE EXCEPTION 'anon cannot see shared country'; END IF;
 IF EXISTS(SELECT 1 FROM public.get_public_player_profile('00000000-0000-0000-0000-000000000003')) THEN RAISE EXCEPTION 'anon saw players-only profile'; END IF;
 IF EXISTS(SELECT 1 FROM public.get_public_player_profile('00000000-0000-0000-0000-000000000004')) THEN RAISE EXCEPTION 'anon saw suspended profile'; END IF;
END $anon$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
DO $fan$ BEGIN
 IF EXISTS(SELECT 1 FROM public.get_public_player_profile('00000000-0000-0000-0000-000000000003')) THEN RAISE EXCEPTION 'fan saw players-only profile'; END IF;
END $fan$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
DO $player$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.get_public_player_profile('00000000-0000-0000-0000-000000000003')) THEN RAISE EXCEPTION 'player cannot see players-only profile'; END IF;
 IF (SELECT current_country FROM public.get_public_player_profile('00000000-0000-0000-0000-000000000003')) IS NOT NULL THEN RAISE EXCEPTION 'player saw another private country'; END IF;
END $player$;
ROLLBACK;
SELECT 'PASS: actual candidate profile function and protected directory visibility' AS result;
