\set ON_ERROR_STOP on
-- Synthetic local-only acceptance; no reviewed dump or hosted rows.
DO $guard$ BEGIN
 IF current_database()<>'hoopcheck_owner_review_fixture' OR inet_server_addr() IS NOT NULL
 THEN RAISE EXCEPTION 'Wrong fixture target'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  CREATE ROLE service_role NOLOGIN;
 END IF;
END $guard$;
CREATE SCHEMA auth;
CREATE SCHEMA hoopcheck_security;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('fixture.owner',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('fixture.jwt',true),''),'{}')::jsonb $$;
CREATE FUNCTION public.confirm_active_account_session() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT current_setting('fixture.active',true)='yes' $$;
CREATE FUNCTION hoopcheck_security.mfa_satisfied() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT current_setting('fixture.mfa',true)='yes' $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,moderation_status text);
CREATE TABLE public.reviews(id uuid PRIMARY KEY, author_id uuid NOT NULL,title text,body text,status text,
 overall_rating numeric,player_season text,team_id uuid,coach_id uuid,league_id uuid,is_anonymous boolean,created_at timestamptz,
 internal_note text);
CREATE TABLE public.womens_team_reviews(id uuid PRIMARY KEY,author_id uuid NOT NULL,title text,body text,status text,
 overall_rating numeric,womens_team_id uuid,is_anonymous boolean,created_at timestamptz,internal_note text);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.womens_team_reviews ENABLE ROW LEVEL SECURITY;
-- Deliberately permissive synthetic row visibility: the RPC must still select only self.
CREATE POLICY fixture_read ON public.reviews FOR SELECT TO authenticated USING(true);
CREATE POLICY fixture_read ON public.womens_team_reviews FOR SELECT TO authenticated USING(true);
GRANT SELECT(id,title,body,status,is_anonymous) ON public.reviews,public.womens_team_reviews TO authenticated;
GRANT USAGE ON SCHEMA auth,hoopcheck_security TO authenticated;
INSERT INTO auth.users VALUES
 ('11111111-1111-4111-8111-111111111111',now()),
 ('22222222-2222-4222-8222-222222222222',now()),
 ('33333333-3333-4333-8333-333333333333',NULL),
 ('44444444-4444-4444-8444-444444444444',now());
INSERT INTO public.profiles SELECT id,CASE WHEN id='44444444-4444-4444-8444-444444444444' THEN 'suspended' ELSE 'active' END FROM auth.users;
INSERT INTO public.reviews(id,author_id,body,status,is_anonymous,internal_note) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner text','pending',true,'never export'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','other text','approved',true,'never export');
INSERT INTO public.womens_team_reviews(id,author_id,body,status,is_anonymous,internal_note)
 SELECT id,author_id,body,status,is_anonymous,internal_note FROM public.reviews;
\ir ../candidates/step2_owner_review_snapshot_review_only.sql
DO $acl$ BEGIN
 IF has_function_privilege('anon','public.get_own_review_snapshot()','EXECUTE')
 OR has_function_privilege('service_role','public.get_own_review_snapshot()','EXECUTE')
 OR has_function_privilege('anon','hoopcheck_review_private.own_review_snapshot()','EXECUTE')
 OR has_column_privilege('authenticated','public.reviews','author_id','SELECT')
 OR has_column_privilege('authenticated','public.womens_team_reviews','author_id','SELECT')
 THEN RAISE EXCEPTION 'Unexpected privilege'; END IF;
END $acl$;
SET ROLE authenticated;
SET fixture.owner='11111111-1111-4111-8111-111111111111';
SET fixture.jwt='{"role":"authenticated","is_anonymous":false}';
SET fixture.active='yes';
SET fixture.mfa='yes';
DO $check$
DECLARE j jsonb;
BEGIN
 j:=public.get_own_review_snapshot();
 IF j->>'owner_id'<>auth.uid()::text OR (j->>'reviews_count')::int<>1
 OR (j->>'womens_reviews_count')::int<>1 OR j->'reviews'->0->>'body'<>'owner text'
 OR j->'womens_reviews'->0->>'author_id'<>auth.uid()::text
 OR j::text LIKE '%internal_note%' OR j::text LIKE '%other text%'
 THEN RAISE EXCEPTION 'Owner projection mismatch'; END IF;
 PERFORM set_config('fixture.owner','22222222-2222-4222-8222-222222222222',false);
 j:=public.get_own_review_snapshot();
 IF j->>'owner_id'<>auth.uid()::text OR j->'reviews'->0->>'body'<>'other text' OR j::text LIKE '%owner text%'
 THEN RAISE EXCEPTION 'Cross-owner projection mismatch'; END IF;
END $check$;
DO $deny$
DECLARE cfg text[];
BEGIN
 FOREACH cfg SLICE 1 IN ARRAY ARRAY[
 ARRAY['fixture.active','no'],ARRAY['fixture.mfa','no'],
 ARRAY['fixture.jwt','{"role":"anon"}'],ARRAY['fixture.jwt','{"role":"authenticated","is_anonymous":true}'],
 ARRAY['fixture.jwt','{"role":"authenticated","client_id":"fixture"}'],
 ARRAY['fixture.owner','33333333-3333-4333-8333-333333333333'],
 ARRAY['fixture.owner','44444444-4444-4444-8444-444444444444'],
 ARRAY['fixture.owner','']
 ] LOOP
  PERFORM set_config('fixture.owner','11111111-1111-4111-8111-111111111111',false);
  PERFORM set_config('fixture.jwt','{"role":"authenticated"}',false);
  PERFORM set_config('fixture.active','yes',false);
  PERFORM set_config('fixture.mfa','yes',false);
  PERFORM set_config(cfg[1],cfg[2],false);
  BEGIN PERFORM public.get_own_review_snapshot(); RAISE EXCEPTION 'Unauthorized snapshot';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
END $deny$;
RESET ROLE;
INSERT INTO public.reviews(id,author_id,body,status,is_anonymous)
 SELECT md5('fixture-'||i)::uuid,'11111111-1111-4111-8111-111111111111','fixture','approved',true FROM generate_series(1,105) i;
SET ROLE authenticated;
SET fixture.owner='11111111-1111-4111-8111-111111111111';
SET fixture.jwt='{"role":"authenticated"}';
SET fixture.active='yes';
SET fixture.mfa='yes';
DO $bound$ DECLARE j jsonb;
BEGIN
 j:=public.get_own_review_snapshot();
 IF (j->>'reviews_count')::int<>101 OR jsonb_array_length(j->'reviews')<>101
 THEN RAISE EXCEPTION 'Overflow sentinel not bounded'; END IF;
END $bound$;
RESET ROLE;
SELECT 'PASS: owner-bound review snapshot, session/MFA denial, raw-column isolation and overflow sentinel';
