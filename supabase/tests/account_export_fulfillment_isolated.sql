-- Synthetic PostgreSQL regression; not actual-schema acceptance.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA hoopcheck_security;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (auth.jwt()->>'sub')::uuid$$;
CREATE FUNCTION public.confirm_active_account_session() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT auth.jwt()->>'session_active'='true'$$;
CREATE FUNCTION hoopcheck_security.mfa_satisfied() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT auth.jwt()->>'mfa'='true'$$;
CREATE TABLE public.profiles (id uuid,display_name text,username text,first_name text,last_name text,bio text,account_type text,country text,current_country text,current_team text,years_pro text,profile_visibility text,free_agent text,hometown text,nationality text,birthdate text,gender text,created_at text,updated_at text,agreed_to_terms text,terms_accepted_at text,terms_version text,theme_preference text,preferred_language text,height text,moderation_status text,stripe_identity_verification_session_id uuid);
CREATE TABLE public.reviews (id uuid,title text,body text,status text,overall_rating text,communication_rating text,professionalism_rating text,development_rating text,payment_rating text,player_season text,team_id uuid,coach_id uuid,league_id uuid,is_anonymous text,created_at text,updated_at text,pay_on_time_rating text,housing_rating text,medical_support_rating text,coaching_quality_rating text,facilities_rating text,playing_time_honesty_rating text,author_id uuid);
CREATE TABLE public.womens_team_reviews (id uuid,title text,body text,status text,overall_rating text,communication_rating text,professionalism_rating text,development_rating text,payment_rating text,womens_team_id uuid,is_anonymous text,created_at text,author_id uuid);
CREATE TABLE public.feed_posts (id uuid,body text,status text,created_at text,expires_at text,post_kind text,post_location text,location_country text,poll_options text,author_id uuid);
CREATE TABLE public.fan_feed_posts (id uuid,team_id uuid,womens_team_id uuid,body text,status text,created_at text,expires_at text,author_id uuid);
CREATE TABLE public.feed_post_comments (id uuid,post_id uuid,body text,created_at text,parent_id uuid,author_id uuid);
CREATE TABLE public.fan_feed_comments (id uuid,post_id uuid,body text,created_at text,author_id uuid);
CREATE TABLE public.review_comments (id uuid,review_id uuid,body text,status text,created_at text,author_id uuid);
CREATE TABLE public.player_contact_messages (id uuid,request_id uuid,body text,created_at text,sender_id uuid);
CREATE TABLE public.player_contact_requests (id uuid,message text,status text,created_at text,responded_at text,requester_id uuid);
CREATE TABLE public.hoop_group_posts (id uuid,channel_id uuid,body text,created_at text,author_id uuid);
CREATE TABLE public.hoop_group_members (space_id uuid,joined_at text,user_id uuid);
CREATE TABLE public.hoop_group_spaces (id uuid,slug text,name text,description text,category text,created_at text,accent_color text,icon_key text,owner_id uuid);
CREATE TABLE public.team_fan_group_members (team_id uuid,joined_at text,user_id uuid);
CREATE TABLE public.team_fan_group_posts (id uuid,team_id uuid,body text,created_at text,status text,author_id uuid);
CREATE TABLE public.team_fan_group_comments (id uuid,post_id uuid,body text,created_at text,author_id uuid);
CREATE TABLE public.subscriptions (id uuid,plan text,status text,access_status text,current_period_end text,cancel_at_period_end text,billing_interval text,created_at text,updated_at text,user_id uuid,stripe_customer_id uuid);
CREATE TABLE public.notifications (id uuid,target_type text,notification_type text,read_at text,created_at text,user_id uuid);
CREATE TABLE public.privacy_requests (id uuid,request_type text,status text,created_at text,updated_at text,completed_at text,requester_id uuid);
CREATE TABLE public.support_tickets (id uuid,subject text,category text,status text,description text,created_at text,updated_at text,resolved_at text,requester_id uuid);
CREATE TABLE public.support_ticket_messages (id uuid,ticket_id uuid,body text,created_at text,author_id uuid);
CREATE TABLE public.player_career_stops (id uuid,team_id uuid,team_name text,league_name text,country text,seasons text,stop_order text,is_public text,created_at text,updated_at text,player_id uuid);
CREATE TABLE public.feed_post_bookmarks (post_id uuid,created_at text,user_id uuid);
CREATE TABLE public.feed_post_checks (id uuid,post_id uuid,created_at text,user_id uuid);
CREATE TABLE public.feed_poll_votes (post_id uuid,option_index text,created_at text,user_id uuid);
CREATE TABLE public.feed_posting_activity (activity_date text,created_at text,user_id uuid);
CREATE TABLE public.fan_live_chat_messages (id uuid,game_id uuid,body text,created_at text,user_id uuid);
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111',now()),('22222222-2222-4222-8222-222222222222',now());
INSERT INTO public.profiles(id,display_name,moderation_status) VALUES ('11111111-1111-4111-8111-111111111111','owner','normal'),('22222222-2222-4222-8222-222222222222','OTHER_PRIVATE','normal');
INSERT INTO public.player_contact_messages(id,sender_id,body) SELECT gen_random_uuid(),'11111111-1111-4111-8111-111111111111','own message '||i FROM generate_series(1,60) i;
INSERT INTO public.player_contact_messages(id,sender_id,body) VALUES(gen_random_uuid(),'22222222-2222-4222-8222-222222222222','OTHER_PRIVATE');
INSERT INTO public.reviews(id,author_id,body) VALUES(gen_random_uuid(),'11111111-1111-4111-8111-111111111111','own review'),(gen_random_uuid(),'22222222-2222-4222-8222-222222222222','OTHER_PRIVATE');
INSERT INTO public.womens_team_reviews(id,author_id,body) VALUES(gen_random_uuid(),'11111111-1111-4111-8111-111111111111','own women review'),(gen_random_uuid(),'22222222-2222-4222-8222-222222222222','OTHER_PRIVATE');
INSERT INTO public.subscriptions(id,user_id,plan,stripe_customer_id) VALUES(gen_random_uuid(),'11111111-1111-4111-8111-111111111111','pro',gen_random_uuid());
\ir ../candidates/account_export_fulfillment_review_only.sql
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_active":"true","mfa":"true"}',false);
DO $$BEGIN
 BEGIN PERFORM public.account_export_job('request','33333333-3333-4333-8333-333333333333'); RAISE EXCEPTION 'disabled was accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM hoopcheck_export_private.records; RAISE EXCEPTION 'raw records exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.run_account_export_worker(); RAISE EXCEPTION 'worker exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
UPDATE hoopcheck_export_private.policy SET enabled=true,scope_version='owned-records-v1',download_ttl=interval '1 hour',max_attempts=2,retry_delay=interval '1 second',request_interval=interval '1 second',max_rows=1000;
SET ROLE authenticated;
DO $$DECLARE v jsonb; BEGIN
 v:=public.account_export_job('request','33333333-3333-4333-8333-333333333333');
 IF v->>'state'<>'queued' OR v->>'id'<>'33333333-3333-4333-8333-333333333333' THEN RAISE EXCEPTION 'queue failed'; END IF;
 v:=public.account_export_job('request','44444444-4444-4444-8444-444444444444');
 IF v->>'id'<>'33333333-3333-4333-8333-333333333333' THEN RAISE EXCEPTION 'duplicate active job'; END IF;
 BEGIN PERFORM public.account_export_job('download','33333333-3333-4333-8333-333333333333'); RAISE EXCEPTION 'premature download'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","session_active":"true","mfa":"true"}',false);
DO $$BEGIN
 BEGIN PERFORM public.account_export_job('status','33333333-3333-4333-8333-333333333333'); RAISE EXCEPTION 'other owner status'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.account_export_job('cancel','33333333-3333-4333-8333-333333333333'); RAISE EXCEPTION 'other owner cancel'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.account_export_job('request','33333333-3333-4333-8333-333333333333'); RAISE EXCEPTION 'other owner id collision'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
DO $$BEGIN
 IF public.run_account_export_worker()<>'ready' OR public.run_account_export_worker()<>'idle' THEN RAISE EXCEPTION 'worker not idempotent'; END IF;
END$$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_active":"true","mfa":"true"}',false);
DO $$DECLARE p jsonb;q jsonb; BEGIN
 p:=public.account_export_job('download','33333333-3333-4333-8333-333333333333',0);
 q:=public.account_export_job('download','33333333-3333-4333-8333-333333333333',(p->>'next_after')::bigint);
 IF p->>'complete'<>'false' OR (p->>'row_count')::int<>64 OR jsonb_array_length(p->'rows')<>50 OR jsonb_array_length(q->'rows')<>14 OR q->>'next_after' IS NOT NULL THEN RAISE EXCEPTION 'incorrect pagination'; END IF;
 IF (p::text||q::text) LIKE '%OTHER_PRIVATE%' OR (p::text||q::text) LIKE '%stripe_customer_id%' OR (p::text||q::text) LIKE '%author_id%' THEN RAISE EXCEPTION 'private data escaped'; END IF;
END$$;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_active":"false","mfa":"true"}',false);
DO $$BEGIN
 BEGIN PERFORM public.account_export_job('download','33333333-3333-4333-8333-333333333333'); RAISE EXCEPTION 'revoked session accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_active":"true","mfa":"true","client_id":"external"}',false);
DO $$BEGIN
 BEGIN PERFORM public.account_export_job('download','33333333-3333-4333-8333-333333333333'); RAISE EXCEPTION 'oauth accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_active":"true","mfa":"true"}',false);
SELECT public.account_export_job('cancel','33333333-3333-4333-8333-333333333333');
RESET ROLE;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM hoopcheck_export_private.records WHERE job_id='33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'cancellation did not scrub'; END IF;
END$$;
-- Test failure recovery, then expiry cleanup, using controlled fixture policy only.
UPDATE hoopcheck_export_private.jobs SET created_at=now()-interval '1 minute' WHERE id='33333333-3333-4333-8333-333333333333';
UPDATE hoopcheck_export_private.policy SET max_rows=1;
SET ROLE authenticated;
SELECT public.account_export_job('request','44444444-4444-4444-8444-444444444444');
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
DO $$BEGIN
 IF public.run_account_export_worker()<>'retry' THEN RAISE EXCEPTION 'retry missing'; END IF;
END$$;
RESET ROLE;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM hoopcheck_export_private.records WHERE job_id='44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'partial records persisted'; END IF;
END$$;
UPDATE hoopcheck_export_private.jobs SET next_attempt=now()-interval '1 minute' WHERE id='44444444-4444-4444-8444-444444444444';
UPDATE hoopcheck_export_private.policy SET max_rows=1000;
SET ROLE service_role;
DO $$BEGIN IF public.run_account_export_worker()<>'ready' THEN RAISE EXCEPTION 'retry did not recover'; END IF; END$$;
RESET ROLE;
UPDATE hoopcheck_export_private.jobs SET expires_at=now()-interval '1 second' WHERE id='44444444-4444-4444-8444-444444444444';
UPDATE hoopcheck_export_private.policy SET enabled=false;
SET ROLE service_role;
DO $$BEGIN IF public.run_account_export_worker()<>'disabled' THEN RAISE EXCEPTION 'disabled worker ran'; END IF; END$$;
RESET ROLE;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM hoopcheck_export_private.records WHERE job_id='44444444-4444-4444-8444-444444444444') OR NOT EXISTS(SELECT 1 FROM hoopcheck_export_private.jobs WHERE id='44444444-4444-4444-8444-444444444444' AND state='expired') THEN RAISE EXCEPTION 'expiry did not scrub'; END IF;
END$$;
\echo PASS: durable export synthetic lifecycle, owner isolation, explicit projections, pagination, retry, cancellation and expiry
