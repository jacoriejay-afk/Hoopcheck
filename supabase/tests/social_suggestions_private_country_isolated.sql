-- Disposable PostgreSQL regression: exercise the actual draft migration against synthetic social graph.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE public.profiles (
 id uuid PRIMARY KEY, display_name text, avatar_url text, current_team text,
 current_country text, current_country_public boolean, country text,
 player_verified boolean, profile_visibility text, account_type text
);
CREATE TABLE public.follow_relationships (follower_id uuid,target_id uuid,target_type text);
CREATE TABLE public.teams (id uuid,name text,logo_url text,country text,league_name text);
CREATE TABLE public.womens_teams (id uuid,name text,logo_url text,country text,league_name text);
INSERT INTO public.profiles VALUES
 ('11111111-1111-4111-8111-111111111111','Viewer',null,null,null,false,null,false,'public','player'),
 ('22222222-2222-4222-8222-222222222222','Followed',null,null,null,false,null,false,'public','player'),
 ('33333333-3333-4333-8333-333333333333','Hidden',null,null,'PRIVATE TEST COUNTRY',false,null,true,'public','player'),
 ('44444444-4444-4444-8444-444444444444','Opted In',null,null,'PUBLIC TEST COUNTRY',true,null,false,'public','player');
INSERT INTO public.follow_relationships VALUES
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','player'),
 ('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','player'),
 ('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','player');
\i supabase/migrations/20261119150000_social_suggestions_private_country.sql
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $test$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.get_social_suggestions()
  WHERE display_name='Hidden' AND detail='Player') THEN
  RAISE EXCEPTION 'private country leaked or hidden suggestion missing';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.get_social_suggestions()
  WHERE display_name='Opted In' AND detail='PUBLIC TEST COUNTRY') THEN
  RAISE EXCEPTION 'public country should appear when opted in';
 END IF;
 IF EXISTS(SELECT 1 FROM public.get_social_suggestions()
  WHERE detail='PRIVATE TEST COUNTRY') THEN
  RAISE EXCEPTION 'private country appeared in suggestions';
 END IF;
END
$test$;
ROLLBACK;
SELECT 'PASS: private country masked, opted-in country shown, graph suggestions retained' AS result;
