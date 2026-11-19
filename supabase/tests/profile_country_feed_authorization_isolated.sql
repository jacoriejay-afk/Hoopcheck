-- Isolated full HoopFeed authorization regression using synthetic data only.
-- Candidate integration of owner-scoped private-country predicate. NOT a production migration.
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
CREATE TABLE public.profiles(id uuid PRIMARY KEY,account_type text,current_country text,profile_visibility text);
CREATE TABLE public.subscriptions(user_id uuid,plan text,status text,access_status text,current_period_end timestamptz);
CREATE TABLE public.follow_relationships(follower_id uuid,target_id uuid,target_type text);
INSERT INTO public.profiles VALUES
 ('11111111-1111-4111-8111-111111111111','player','Secret Country','public'),
 ('22222222-2222-4222-8222-222222222222','player','secret country','public'),
 ('33333333-3333-4333-8333-333333333333','player','Other Country','public'),
 ('44444444-4444-4444-8444-444444444444','fan',null,'public'),
 ('55555555-5555-4555-8555-555555555555','player',null,'public'),
 ('66666666-6666-4666-8666-666666666666','coach',null,'public'),
 ('77777777-7777-4777-8777-777777777777','manager',null,'public');
INSERT INTO public.subscriptions VALUES
 ('11111111-1111-4111-8111-111111111111','pro','active','active',now()+interval '30 days'),
 ('44444444-4444-4444-8444-444444444444','premium','active','active',now()+interval '30 days'),
 ('55555555-5555-4555-8555-555555555555','pro','active','active',now()-interval '1 day'),
 ('66666666-6666-4666-8666-666666666666','pro','active','active',now()+interval '30 days');
INSERT INTO public.follow_relationships VALUES
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','player'),
 ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','player'),
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','player'),
 ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','player'),
 ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','player');
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_read ON public.profiles FOR SELECT TO authenticated USING(profile_visibility='public' OR id=auth.uid());
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscription_own ON public.subscriptions FOR SELECT TO authenticated USING(user_id=auth.uid());
ALTER TABLE public.follow_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_own ON public.follow_relationships FOR SELECT TO authenticated USING(follower_id=auth.uid());
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT(id,account_type,profile_visibility) ON public.profiles TO authenticated;
GRANT SELECT ON public.subscriptions,public.follow_relationships TO authenticated;
-- No standalone public country-equality helper: prevent the equality oracle.
-- Synthetic admin identity tests the override branch; production admin-role lookup is not reproduced.
CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_moderator() RETURNS boolean
 LANGUAGE sql STABLE AS $$ SELECT auth.uid()='77777777-7777-4777-8777-777777777777'::uuid $$;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin_or_moderator() TO authenticated;
-- Same predicates as production function; protected definer performs the private-country comparison internally.
CREATE OR REPLACE FUNCTION public.can_view_player_feed_post(p_author_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $
 SELECT p_author_id=(SELECT auth.uid())
 OR public.is_current_user_admin_or_moderator()
 OR EXISTS(
 SELECT 1 FROM public.profiles viewer
 JOIN public.subscriptions sub ON sub.user_id=viewer.id
 JOIN public.profiles author ON author.id=p_author_id
 JOIN public.follow_relationships fr ON fr.follower_id=viewer.id
   AND fr.target_id=p_author_id AND fr.target_type=author.account_type
 WHERE viewer.id=(SELECT auth.uid())
 AND viewer.account_type IN ('player','fan','coach','agent','scout','club_admin','manager')
 AND author.account_type IN ('player','fan','coach','agent','scout','club_admin','manager')
 AND sub.plan IN ('pro','premium')
 AND sub.status IN ('active','trialing')
 AND coalesce(sub.access_status,'active') IN ('active','trialing','pro','premium')
 AND (sub.current_period_end IS NULL OR sub.current_period_end>now())
 AND (viewer.account_type<>'player' OR author.account_type<>'player'
      OR (viewer.current_country IS NOT NULL AND author.current_country IS NOT NULL
          AND lower(viewer.current_country)=lower(author.current_country)))
 )
$$;
REVOKE ALL ON FUNCTION public.can_view_player_feed_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_player_feed_post(uuid) TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF NOT public.can_view_player_feed_post('22222222-2222-4222-8222-222222222222') THEN RAISE EXCEPTION 'same private country follower denied'; END IF;
 IF public.can_view_player_feed_post('33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'different private country follower allowed'; END IF;
 IF NOT public.can_view_player_feed_post('11111111-1111-4111-8111-111111111111') THEN RAISE EXCEPTION 'owner denied'; END IF;
 IF has_column_privilege('authenticated','public.profiles','current_country','SELECT') THEN RAISE EXCEPTION 'private column exposed'; END IF;
 -- Prove a real SQL read fails, not merely that privilege metadata looks correct.
 BEGIN
  EXECUTE 'SELECT current_country FROM public.profiles LIMIT 1';
  RAISE EXCEPTION 'raw country SELECT unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN
  NULL;
 END;
END $$;
SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
DO $$ BEGIN
 IF NOT public.can_view_player_feed_post('22222222-2222-4222-8222-222222222222') THEN RAISE EXCEPTION 'fan follower unexpectedly denied'; END IF;
 IF public.can_view_player_feed_post('33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'fan without follow allowed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
DO $$ BEGIN
 IF public.can_view_player_feed_post('22222222-2222-4222-8222-222222222222') THEN RAISE EXCEPTION 'expired subscription allowed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
DO $$ BEGIN
 IF NOT public.can_view_player_feed_post('22222222-2222-4222-8222-222222222222') THEN RAISE EXCEPTION 'coach premium follower unexpectedly denied'; END IF;
 IF public.can_view_player_feed_post('33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'coach without follow allowed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
DO $$ BEGIN
 IF NOT public.can_view_player_feed_post('33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'synthetic admin override denied'; END IF;
END $$;
-- Missing authenticated identity must not pass any follower/subscription country gate.
SELECT set_config('request.jwt.claim.sub','',true);
DO $ BEGIN
 IF public.can_view_player_feed_post('22222222-2222-4222-8222-222222222222') THEN
  RAISE EXCEPTION 'missing JWT unexpectedly allowed feed access';
 END IF;
END $;
RESET ROLE;
-- Anonymous callers must not be able to execute the feed or comparison functions.
DO $ BEGIN
 IF has_function_privilege('anon','public.can_view_player_feed_post(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'anon can execute feed authorization';
 END IF;
 IF to_regprocedure('public.is_my_player_country_match(uuid)') IS NOT NULL THEN
  RAISE EXCEPTION 'standalone country comparison must not exist';
 END IF;
END $;
ROLLBACK;
SELECT 'PASS: synthetic full feed predicate preserved key country/follow/subscription gates' AS result;
