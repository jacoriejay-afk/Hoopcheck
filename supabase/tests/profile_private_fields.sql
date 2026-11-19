\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator; END IF;
END $$;
CREATE TABLE auth.mfa_factors(user_id uuid,status text);
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
ALTER TABLE public.profiles ADD COLUMN "created_at" timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN "updated_at" timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN "is_adult" boolean;
ALTER TABLE public.profiles ADD COLUMN "agreed_to_terms" boolean;
ALTER TABLE public.profiles ADD COLUMN "terms_accepted_at" timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN "terms_version" text;
ALTER TABLE public.profiles ADD COLUMN "profile_claimed" boolean;
ALTER TABLE public.profiles ADD COLUMN "claimed_at" timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN "first_name" text;
ALTER TABLE public.profiles ADD COLUMN "last_name" text;
ALTER TABLE public.profiles ADD COLUMN "professional_experience" boolean;
ALTER TABLE public.profiles ADD COLUMN "moderation_note" text;
ALTER TABLE public.profiles ADD COLUMN "moderation_updated_at" timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN "moderation_updated_by" uuid;
ALTER TABLE public.profiles ADD COLUMN "interests" text;
ALTER TABLE public.profiles ADD COLUMN "favorite_leagues" text;
ALTER TABLE public.profiles ADD COLUMN "favorite_teams" text;
ALTER TABLE public.profiles ADD COLUMN "experience_summary" text;
ALTER TABLE public.profiles ADD COLUMN "avatar_moderation_note" text;
ALTER TABLE public.profiles ADD COLUMN "hometown" text;
ALTER TABLE public.profiles ADD COLUMN "nationality" text;
ALTER TABLE public.profiles ADD COLUMN "display_name_changed_at" timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN "selected_team_id" uuid;
ALTER TABLE public.profiles ADD COLUMN "selected_team_verified" boolean;
ALTER TABLE public.profiles ADD COLUMN "selected_womens_team_id" uuid;
ALTER TABLE public.profiles ADD COLUMN "stripe_identity_verification_session_id" text;
ALTER TABLE public.profiles ADD COLUMN "identity_verification_status" text;
ALTER TABLE public.profiles ADD COLUMN "coach_profile_id" uuid;
ALTER TABLE public.profiles ADD COLUMN "coach_verified" boolean;
ALTER TABLE public.profiles ADD COLUMN "coach_verified_at" timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN "birthdate" date;
ALTER TABLE public.profiles ADD COLUMN "gender" text;
ALTER TABLE public.profiles ADD COLUMN "last_seen_at" timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN "experience_goal" text;
ALTER TABLE public.profiles ADD COLUMN "research_preferences" text;
ALTER TABLE public.profiles ADD COLUMN "theme_preference" text;
ALTER TABLE public.profiles ADD COLUMN "preferred_language" text;
ALTER TABLE public.profiles ADD COLUMN "notification_preferences" jsonb;
ALTER TABLE public.profiles ADD COLUMN "preferred_basketball_side" text;
ALTER TABLE public.profiles ADD COLUMN "height" text;
ALTER TABLE public.profiles ADD COLUMN future_private_secret text DEFAULT 'future-only';
UPDATE public.profiles SET moderation_note='Owner-only moderation', preferred_language='es', notification_preferences='{}'::jsonb, birthdate='2000-01-01', stripe_identity_verification_session_id='vs_private';
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT ON public.profiles TO anon,authenticated;
-- Model the existing denied fields before rollout, not a permissive toy schema.
REVOKE SELECT ON public.profiles FROM anon,authenticated;
DO $$ DECLARE cols text; BEGIN
 SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attnum>0 AND NOT attisdropped AND attname NOT IN ('birthdate','stripe_identity_verification_session_id','future_private_secret');
 EXECUTE 'GRANT SELECT ('||cols||') ON public.profiles TO anon,authenticated';
END $$;
GRANT UPDATE (display_name,current_country,preferred_language) ON public.profiles TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY visible_profiles ON public.profiles FOR SELECT TO anon,authenticated USING(profile_visibility='public' OR id=auth.uid());
CREATE POLICY own_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE FUNCTION public.is_current_user_admin_or_moderator() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='99999999-9999-4999-8999-999999999999'::uuid $$;
CREATE TABLE public.follow_relationships(follower_id uuid,target_id uuid,target_type text);
CREATE TABLE public.membership_authorizations(user_id uuid,plan text,status text,access_status text,current_period_end timestamptz);
CREATE TABLE public.teams(id uuid PRIMARY KEY,name text,logo_url text,country text,league_name text);
CREATE TABLE public.womens_teams(LIKE public.teams INCLUDING ALL);
INSERT INTO public.membership_authorizations VALUES('11111111-1111-4111-8111-111111111111','premium','active','active',now()+interval '1 day');
INSERT INTO public.follow_relationships VALUES
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','player'),
 ('11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666','player'),
 ('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','player');
GRANT SELECT ON public.follow_relationships,public.membership_authorizations,public.teams,public.womens_teams TO anon,authenticated;
-- Existing administrator API remains the authorized cross-account read path.
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
INSERT INTO auth.users SELECT id,'fixture@hoopcheck.invalid' FROM public.profiles;
CREATE OR REPLACE FUNCTION public.admin_list_users(p_account_type text DEFAULT NULL::text, p_query text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, email text, display_name text, username text, account_type text, player_verified boolean, moderation_status text, moderation_note text, avatar_url text, avatar_moderation_status text, bio text, current_country text, current_team text, profile_visibility text, free_agent boolean, interests text, favorite_leagues text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select p.id,u.email::text,p.display_name,p.username,p.account_type,p.player_verified,p.moderation_status,p.moderation_note,p.avatar_url,p.avatar_moderation_status,p.bio,p.current_country,p.current_team,p.profile_visibility,p.free_agent,p.interests,p.favorite_leagues,p.created_at
 from public.profiles p join auth.users u on u.id=p.id
 where public.is_current_user_admin_or_moderator()
 and (p_account_type is null or p.account_type=p_account_type)
 and (p_query is null or p_query='' or lower(coalesce(u.email,'')) like '%'||lower(p_query)||'%' or lower(coalesce(p.username,'')) like '%'||lower(p_query)||'%' or lower(coalesce(p.display_name,'')) like '%'||lower(p_query)||'%')
 order by p.created_at desc;
$function$
;
\ir ../migrations/20261118162456_opted_in_mfa_enforcement.sql
\ir ../migrations/20261119074537_profile_private_field_boundary.sql
\ir ../migrations/20261119075626_restrict_private_profile_columns.sql
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
DO $$ DECLARE col text; BEGIN
 FOREACH col IN ARRAY ARRAY['current_country','moderation_note','avatar_moderation_note','notification_preferences','preferred_language','birthdate','stripe_identity_verification_session_id','future_private_secret'] LOOP
  IF has_column_privilege('anon','public.profiles',col,'SELECT') OR has_column_privilege('authenticated','public.profiles',col,'SELECT') THEN RAISE EXCEPTION 'private column still readable: %',col; END IF;
 END LOOP;
 IF NOT has_column_privilege('anon','public.profiles','display_name','SELECT') THEN RAISE EXCEPTION 'public columns lost'; END IF;
 BEGIN PERFORM current_country FROM public.profiles; RAISE EXCEPTION 'raw private read succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_own_profile(); RAISE EXCEPTION 'anon own RPC succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT current_country FROM public.get_public_player_profile('11111111-1111-4111-8111-111111111111')) IS NOT NULL THEN RAISE EXCEPTION 'canonical private country leaked'; END IF;
 IF (SELECT avatar_url FROM public.get_public_player_profile('11111111-1111-4111-8111-111111111111')) IS NOT NULL THEN RAISE EXCEPTION 'canonical rejected avatar leaked'; END IF;
 IF EXISTS(SELECT FROM public.search_public_players_by_username(p_username => 'player') WHERE username='player_one' AND (current_country IS NOT NULL OR avatar_url IS NOT NULL)) THEN RAISE EXCEPTION 'username discovery leak'; END IF;
 IF EXISTS(SELECT FROM public.search_public_players_by_username('player','Hidden Country',10,0)) THEN RAISE EXCEPTION 'private country filter leak'; END IF;
 IF EXISTS(SELECT FROM public.search_public_players('','Hidden Country','',false,24)) THEN RAISE EXCEPTION 'legacy private country filter leak'; END IF;
 IF EXISTS(SELECT FROM public.search_public_players_page('','Hidden Country','',false,24,0)) THEN RAISE EXCEPTION 'paged private country filter leak'; END IF;
 IF (SELECT count(*) FROM public.search_public_players_by_username(p_username => 'player'))<>2 THEN RAISE EXCEPTION 'public eligible directory changed'; END IF;
 IF (SELECT count(*) FROM public.get_public_player_profile('33333333-3333-4333-8333-333333333333'))<>0 THEN RAISE EXCEPTION 'players-only leaked'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","aal":"aal1"}',true);
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ DECLARE own jsonb; BEGIN
 own:=public.get_own_profile();
 IF own->>'id' <> auth.uid()::text OR own->>'current_country'<>'Hidden Country' OR own->>'preferred_language'<>'es' THEN RAISE EXCEPTION 'own private read unavailable'; END IF;
 IF own ?| ARRAY['birthdate','stripe_identity_verification_session_id','future_private_secret'] THEN RAISE EXCEPTION 'previously private or future field re-granted'; END IF;
 IF (SELECT count(*) FROM public.get_public_player_profile('33333333-3333-4333-8333-333333333333'))<>1 THEN RAISE EXCEPTION 'players-only player gate lost'; END IF;
 IF (SELECT current_country FROM public.get_public_player_profile('22222222-2222-4222-8222-222222222222'))<>'Visible Country' THEN RAISE EXCEPTION 'opt-in public country unavailable'; END IF;
 UPDATE public.profiles SET current_country='Owner updated country' WHERE id=auth.uid();
 IF public.get_own_profile()->>'current_country'<>'Owner updated country' THEN RAISE EXCEPTION 'own update lost'; END IF;
 UPDATE public.profiles SET display_name='FORGED' WHERE id='22222222-2222-4222-8222-222222222222';
 IF EXISTS(SELECT FROM public.profiles WHERE display_name='FORGED') THEN RAISE EXCEPTION 'cross-owner write permitted'; END IF;
END $$;
RESET ROLE;
-- The real MFA migration helper inspects verified factors, not editable metadata.
INSERT INTO auth.mfa_factors VALUES('11111111-1111-4111-8111-111111111111','verified');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.get_own_profile(); RAISE EXCEPTION 'unproved MFA private read succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT FROM public.search_public_players_by_username(p_username => 'player')) THEN RAISE EXCEPTION 'discovery bypassed MFA'; END IF;
 IF EXISTS(SELECT FROM public.get_public_player_profile('22222222-2222-4222-8222-222222222222')) THEN RAISE EXCEPTION 'detail bypassed MFA'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2"}',true);
DO $$ BEGIN IF public.get_own_profile()->>'id'<>auth.uid()::text THEN RAISE EXCEPTION 'full MFA owner read failed'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN IF public.get_own_profile()->>'id'<>auth.uid()::text OR public.get_own_profile()->>'current_country'<>'Visible Country' THEN RAISE EXCEPTION 'cross-account owner isolation failed'; END IF; END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2","is_anonymous":true}',true);
DO $$ BEGIN BEGIN PERFORM public.get_own_profile(); RAISE EXCEPTION 'anonymous Auth user private read succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
-- Retain paid/followed country-based feed permission without making private
-- country readable, and mask suggestion fallback/avatars independently.
INSERT INTO public.profiles(id,account_type,profile_visibility,moderation_status,display_name,username,current_country,current_country_public,avatar_url,avatar_moderation_status,country)
 VALUES('77777777-7777-4777-8777-777777777777','player','public','normal','Suggested player','suggested_player','Private suggestion location',false,'https://fixture.test/pending.jpg','pending','Public country');
INSERT INTO public.follow_relationships VALUES('22222222-2222-4222-8222-222222222222','77777777-7777-4777-8777-777777777777','player');
UPDATE public.profiles SET current_country='Owner updated country',current_country_public=false WHERE id='22222222-2222-4222-8222-222222222222';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2"}',true);
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF public.can_view_player_feed_post('22222222-2222-4222-8222-222222222222') IS DISTINCT FROM true THEN RAISE EXCEPTION 'existing paid/followed same-country permission lost'; END IF;
 IF public.can_view_player_feed_post('77777777-7777-4777-8777-777777777777') IS TRUE THEN RAISE EXCEPTION 'unfollowed different-country permission added'; END IF;
 IF NOT EXISTS(SELECT FROM public.get_social_suggestions() WHERE entity_id='77777777-7777-4777-8777-777777777777' AND detail='Public country' AND avatar_url IS NULL) THEN RAISE EXCEPTION 'suggestion privacy/approved-avatar boundary failed'; END IF;
END $$;
RESET ROLE;
UPDATE public.membership_authorizations SET current_period_end=now()-interval '1 second';
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF public.can_view_player_feed_post('22222222-2222-4222-8222-222222222222') IS TRUE THEN RAISE EXCEPTION 'expired membership granted feed access'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN IF EXISTS(SELECT FROM public.admin_list_users()) THEN RAISE EXCEPTION 'member can read administrator projection'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
DO $$ BEGIN IF (SELECT count(*) FROM public.admin_list_users())<>6 OR NOT EXISTS(SELECT FROM public.admin_list_users() WHERE moderation_note='Owner-only moderation') THEN RAISE EXCEPTION 'existing administrator access lost'; END IF; END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_own_profile','get_public_player_profile','search_public_players','search_public_players_by_username','search_public_players_page','can_view_player_feed_post','get_social_suggestions') AND p.prosecdef) THEN RAISE EXCEPTION 'privileged public projection exposed'; END IF;
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='hoopcheck_security' AND p.prosecdef AND NOT coalesce(p.proconfig,'{}') @> ARRAY['search_path=""']) THEN RAISE EXCEPTION 'unsafe private search path'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: raw private fields denied, masked current/legacy RPCs, owner reads/updates, cross-account/anonymous/MFA/future-column isolation; fixtures rolled back' AS result;
