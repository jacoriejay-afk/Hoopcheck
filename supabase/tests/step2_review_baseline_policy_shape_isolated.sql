\set ON_ERROR_STOP on
-- Synthetic policy-composition regression derived from the exported PG17 schema.
-- Helper predicates and profile/subscription rows are synthetic; not full-schema parity.
BEGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION private.is_admin_or_moderator() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('fixture.mod',true),'')='yes' $$;
CREATE FUNCTION private.is_active_subscriber() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('fixture.paid',true),'')='yes' $$;
GRANT USAGE ON SCHEMA auth, private TO anon, authenticated;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,account_type text);
CREATE TABLE public.subscriptions(user_id uuid,plan text,status text,current_period_end timestamptz);
GRANT SELECT ON public.profiles,public.subscriptions TO anon,authenticated;
CREATE TABLE public.reviews(id int PRIMARY KEY,author_id uuid NOT NULL,status text NOT NULL,is_anonymous boolean NOT NULL);
CREATE TABLE public.womens_team_reviews(LIKE public.reviews INCLUDING ALL);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.womens_team_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.reviews,public.womens_team_reviews TO anon,authenticated;
CREATE POLICY "reviews paid read guard" ON public.reviews AS RESTRICTIVE FOR SELECT TO authenticated,anon
USING (
 auth.uid() IS NOT NULL AND (
 author_id=auth.uid() OR private.is_admin_or_moderator() OR
 (private.is_active_subscriber() AND EXISTS (
 SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.account_type<>'fan'
 ))
 )
);
CREATE POLICY reviews_subscriber_read ON public.reviews FOR SELECT TO authenticated
USING (
 (status='approved' AND private.is_active_subscriber() AND EXISTS (
 SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND (
 p.account_type<>'fan' OR EXISTS (
 SELECT 1 FROM public.subscriptions s WHERE s.user_id=auth.uid() AND s.plan='premium'
 AND s.status IN ('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end>now())
 )
 )
 ))
 OR author_id=auth.uid() OR private.is_admin_or_moderator()
);
CREATE POLICY "womens review paid read guard" ON public.womens_team_reviews FOR SELECT TO authenticated
USING (
 auth.uid() IS NOT NULL AND (
 author_id=auth.uid() OR private.is_admin_or_moderator() OR
 (status='approved' AND private.is_active_subscriber() AND EXISTS (
 SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND (
 p.account_type<>'fan' OR EXISTS (
 SELECT 1 FROM public.subscriptions s WHERE s.user_id=auth.uid() AND s.plan='premium'
 AND s.status IN ('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end>now())
 )
 )
 ))
 )
);
INSERT INTO public.profiles VALUES
('11111111-1111-4111-8111-111111111111','player'),
('22222222-2222-4222-8222-222222222222','player'),
('33333333-3333-4333-8333-333333333333','fan');
INSERT INTO public.subscriptions VALUES ('33333333-3333-4333-8333-333333333333','premium','active',now()+interval '30 days');
INSERT INTO public.reviews VALUES
(1,'11111111-1111-4111-8111-111111111111','approved',true),
(2,'11111111-1111-4111-8111-111111111111','pending',false),
(3,'11111111-1111-4111-8111-111111111111','rejected',false);
INSERT INTO public.womens_team_reviews SELECT * FROM public.reviews;
CREATE FUNCTION public.fixture_expect(men int,women int) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 IF (SELECT count(*) FROM public.reviews)<>men OR (SELECT count(*) FROM public.womens_team_reviews)<>women THEN
 RAISE EXCEPTION 'unexpected baseline row visibility';
 END IF;
END $$;
COMMIT;
SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
SET fixture.paid='yes';
SELECT public.fixture_expect(1,1);
-- Known unresolved baseline gap: table SELECT grants expose anonymous author IDs.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.reviews WHERE is_anonymous AND author_id='11111111-1111-4111-8111-111111111111')
 OR NOT EXISTS(SELECT 1 FROM public.womens_team_reviews WHERE is_anonymous AND author_id='11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'fixture no longer models baseline author-column exposure'; END IF;
END $$;
RESET ROLE;
CREATE FUNCTION public.fixture_matrix() RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 PERFORM set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
 PERFORM set_config('fixture.paid','yes',false);
 PERFORM set_config('fixture.mod','no',false);
 PERFORM public.fixture_expect(1,1);
 PERFORM set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
 PERFORM public.fixture_expect(0,1);
 PERFORM set_config('fixture.paid','no',false);
 PERFORM public.fixture_expect(0,0);
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
 PERFORM public.fixture_expect(3,3);
 PERFORM set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
 PERFORM set_config('fixture.mod','yes',false);
 PERFORM public.fixture_expect(3,3);
END $$;
SET ROLE authenticated;
SELECT public.fixture_matrix();
RESET ROLE;
SET ROLE anon;
SET request.jwt.claim.sub='';
SET fixture.mod='no';
SELECT public.fixture_expect(0,0);
RESET ROLE;
\ir ../candidates/step2_review_moderation_read_guard_review_only.sql
SET ROLE authenticated;
SELECT public.fixture_matrix();
RESET ROLE;
SET ROLE anon;
SET request.jwt.claim.sub='';
SET fixture.mod='no';
SELECT public.fixture_expect(0,0);
RESET ROLE;
SELECT 'PASS: baseline-shaped review policies preserve row visibility; author-column privacy remains unresolved' AS result;
