\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
DO $$ BEGIN
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, account_type text, profile_visibility text, moderation_status text,
 display_name text, username text, avatar_url text, avatar_moderation_status text DEFAULT 'approved',
 country text, bio text, position text, years_pro integer, current_country text, current_country_public boolean DEFAULT false,
 current_team text, player_verified boolean, player_verified_at timestamptz, free_agent boolean, basketball_type text);
INSERT INTO public.profiles(id,account_type,profile_visibility,moderation_status,display_name,username,current_country,current_country_public,avatar_url,avatar_moderation_status,basketball_type) VALUES
 ('11111111-1111-4111-8111-111111111111','player','public','normal','Private Country','player_one','Hidden Country',false,'https://fixture.test/rejected.jpg','rejected','mens'),
 ('22222222-2222-4222-8222-222222222222','player','public','normal','Public Country','player_two','Visible Country',true,'https://fixture.test/approved.jpg','approved','womens'),
 ('33333333-3333-4333-8333-333333333333','player','players_only','normal','Players Only','player_three','Hidden Country',false,null,'pending','mens'),
 ('44444444-4444-4444-8444-444444444444','player','public','suspended','Suspended','player_four','Visible Country',true,null,'approved','mens'),
 ('55555555-5555-4555-8555-555555555555','fan','players_only','normal','Fan','fan',null,false,null,'approved',null),
 ('66666666-6666-4666-8666-666666666666','coach','players_only','normal','Coach','coach',null,false,null,'approved',null);
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT ON public.profiles TO anon,authenticated;
-- Production signature/defaults: replacement must preserve both.
CREATE FUNCTION public.search_public_players(p_query text DEFAULT ''::text, p_country text DEFAULT ''::text, p_position text DEFAULT ''::text, p_verified_only boolean DEFAULT false, p_limit integer DEFAULT 24)
RETURNS TABLE(id uuid, display_name text, avatar_url text, country text, bio text, player_position text, years_pro integer, current_country text, current_team text, player_verified boolean, player_verified_at timestamptz)
LANGUAGE sql AS $$ SELECT p.id,p.display_name,p.avatar_url,p.country,p.bio,p.position,p.years_pro,p.current_country,p.current_team,p.player_verified,p.player_verified_at FROM public.profiles p WHERE false $$;
\ir ../migrations/20261118162305_player_profile_country_privacy.sql
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF (SELECT current_country FROM public.get_public_player_profile('11111111-1111-4111-8111-111111111111')) IS NOT NULL THEN RAISE EXCEPTION 'private country leaked'; END IF;
 IF (SELECT avatar_url FROM public.get_public_player_profile('11111111-1111-4111-8111-111111111111')) IS NOT NULL THEN RAISE EXCEPTION 'rejected avatar leaked'; END IF;
 IF (SELECT count(*) FROM public.get_public_player_profile('33333333-3333-4333-8333-333333333333'))<>0 THEN RAISE EXCEPTION 'players-only profile leaked to anon'; END IF;
 IF (SELECT count(*) FROM public.search_public_players_by_username('player'))<>2 THEN RAISE EXCEPTION 'directory eligibility changed'; END IF;
 IF EXISTS(SELECT FROM public.search_public_players_by_username('player') WHERE username='player_one' AND (current_country IS NOT NULL OR avatar_url IS NOT NULL)) THEN RAISE EXCEPTION 'directory privacy leaked'; END IF;
 IF (SELECT count(*) FROM public.search_public_players_by_username('player','Hidden Country'))<>0 THEN RAISE EXCEPTION 'private country filter leaks location'; END IF;
 IF (SELECT count(*) FROM public.search_public_players_by_username('player','Visible'))<>1 THEN RAISE EXCEPTION 'public country filter failed'; END IF;
 IF (SELECT count(*) FROM public.search_public_players_by_username('player_'))<>2 THEN RAISE EXCEPTION 'literal underscore search failed'; END IF;
 IF (SELECT count(*) FROM public.search_public_players_by_username('pl%'))<>0 THEN RAISE EXCEPTION 'wildcard interpreted'; END IF;
 IF (SELECT count(*) FROM public.search_public_players_by_username('p'))<>0 THEN RAISE EXCEPTION 'short query accepted'; END IF;
 IF (SELECT count(*) FROM public.search_public_players_by_username('player',null,1,1))<>1 THEN RAISE EXCEPTION 'pagination failed'; END IF;
 IF (SELECT count(*) FROM public.search_public_players())<>1 THEN RAISE EXCEPTION 'legacy zero-argument defaults lost'; END IF;
 IF (SELECT count(*) FROM public.search_public_players('player'))<>1 THEN RAISE EXCEPTION 'legacy positional partial call lost'; END IF;
 -- Verify the production five-argument legacy RPC and the main website paginated RPC.
 IF (SELECT count(*) FROM public.search_public_players('player','','',false,24))<>1 THEN RAISE EXCEPTION 'legacy directory eligibility changed'; END IF;
 IF EXISTS(SELECT FROM public.search_public_players('player','','',false,24) WHERE current_country IS NOT NULL OR avatar_url IS NOT NULL) THEN RAISE EXCEPTION 'legacy directory privacy leaked'; END IF;
 IF (SELECT count(*) FROM public.search_public_players('Hidden Country','','',false,24))<>0 THEN RAISE EXCEPTION 'legacy search matches private country'; END IF;
 IF (SELECT count(*) FROM public.search_public_players_page('player','','',false,24,0))<>1 THEN RAISE EXCEPTION 'website directory eligibility changed'; END IF;
 IF EXISTS(SELECT FROM public.search_public_players_page('player','','',false,24,0) WHERE current_country IS NOT NULL OR avatar_url IS NOT NULL) THEN RAISE EXCEPTION 'website directory privacy leaked'; END IF;
 IF (SELECT count(*) FROM public.search_public_players_page('Hidden Country','','',false,24,0))<>0 THEN RAISE EXCEPTION 'website search matches private country'; END IF;
 IF (SELECT count(*) FROM public.search_public_players_page('player','Hidden Country','',false,24,0))<>0 THEN RAISE EXCEPTION 'website country filter leaks private country'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF (SELECT current_country FROM public.get_public_player_profile('11111111-1111-4111-8111-111111111111'))<>'Hidden Country' THEN RAISE EXCEPTION 'owner cannot see own country'; END IF;
 IF (SELECT count(*) FROM public.get_public_player_profile('33333333-3333-4333-8333-333333333333'))<>1 THEN RAISE EXCEPTION 'player cannot view players-only profile'; END IF;
 IF (SELECT count(*) FROM public.get_public_player_profile('44444444-4444-4444-8444-444444444444'))<>0 THEN RAISE EXCEPTION 'suspended profile visible'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
DO $$ BEGIN IF (SELECT count(*) FROM public.search_public_players_by_username('player'))<>0 THEN RAISE EXCEPTION 'fan directory gate failed'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
DO $$ BEGIN IF (SELECT count(*) FROM public.get_public_player_profile('33333333-3333-4333-8333-333333333333'))<>0 THEN RAISE EXCEPTION 'coach read players-only profile'; END IF; END $$;
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT FROM pg_proc WHERE oid IN ('public.search_public_players_by_username(text,text,integer,integer)'::regprocedure,'public.get_public_player_profile(uuid)'::regprocedure) AND prosecdef) THEN RAISE EXCEPTION 'security-definer privilege escalation'; END IF; END $$;
ROLLBACK;
SELECT 'PASS: profile, country, moderation, role, literal search and pagination; all fixtures rolled back' AS result;
