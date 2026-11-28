\set ON_ERROR_STOP on
-- Synthetic direct-table ACL rehearsal only; not full-schema or API acceptance.
BEGIN;
CREATE TABLE public.reviews (author_id uuid NOT NULL,id uuid PRIMARY KEY,coach_id text,team_id text,league_id text,overall_rating text,communication_rating text,professionalism_rating text,development_rating text,payment_rating text,title text,body text,status text,created_at text,updated_at text,is_anonymous boolean,player_season text,legal_review_required text,pay_on_time_rating text,housing_rating text,medical_support_rating text,coaching_quality_rating text,facilities_rating text,playing_time_honesty_rating text);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.reviews TO anon,authenticated,service_role;
GRANT INSERT ON public.reviews TO authenticated;
CREATE POLICY approved_or_own ON public.reviews FOR SELECT TO authenticated USING (status='approved' OR author_id=nullif(current_setting('fixture.uid',true),'')::uuid);
CREATE POLICY own_insert ON public.reviews FOR INSERT TO authenticated WITH CHECK (author_id=nullif(current_setting('fixture.uid',true),'')::uuid);
CREATE POLICY service_read ON public.reviews FOR SELECT TO service_role USING (true);
INSERT INTO public.reviews(id,author_id,status,is_anonymous) VALUES ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','approved',true),('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','pending',false);
CREATE TABLE public.womens_team_reviews (author_id uuid NOT NULL,id uuid PRIMARY KEY,womens_team_id text,overall_rating text,communication_rating text,professionalism_rating text,development_rating text,payment_rating text,title text,body text,status text,is_anonymous boolean,created_at text);
ALTER TABLE public.womens_team_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.womens_team_reviews TO anon,authenticated,service_role;
GRANT INSERT ON public.womens_team_reviews TO authenticated;
CREATE POLICY approved_or_own ON public.womens_team_reviews FOR SELECT TO authenticated USING (status='approved' OR author_id=nullif(current_setting('fixture.uid',true),'')::uuid);
CREATE POLICY own_insert ON public.womens_team_reviews FOR INSERT TO authenticated WITH CHECK (author_id=nullif(current_setting('fixture.uid',true),'')::uuid);
CREATE POLICY service_read ON public.womens_team_reviews FOR SELECT TO service_role USING (true);
INSERT INTO public.womens_team_reviews(id,author_id,status,is_anonymous) VALUES ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','approved',true),('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','pending',false);
COMMIT;
SET ROLE authenticated;
SET fixture.uid='44444444-4444-4444-8444-444444444444';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.reviews WHERE author_id='22222222-2222-4222-8222-222222222222') OR NOT EXISTS(SELECT 1 FROM public.womens_team_reviews WHERE author_id='22222222-2222-4222-8222-222222222222') THEN RAISE EXCEPTION 'baseline ACL exposure not reproduced'; END IF;
END $$;
RESET ROLE;
\ir ../candidates/step2_review_author_column_acl_review_only.sql
SET ROLE authenticated;
DO $test$
DECLARE t text; n int; bad text;
BEGIN
 FOREACH t IN ARRAY ARRAY['reviews','womens_team_reviews'] LOOP
  EXECUTE format('SELECT count(id) FROM public.%I WHERE status=''approved''',t) INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'safe-column read regressed'; END IF;
  FOREACH bad IN ARRAY ARRAY['SELECT author_id FROM public.%I','SELECT * FROM public.%I','SELECT id FROM public.%I WHERE author_id IS NOT NULL','SELECT id FROM public.%I ORDER BY author_id'] LOOP
   BEGIN
    EXECUTE format(bad,t);
    RAISE EXCEPTION 'raw author access was not denied';
   EXCEPTION WHEN insufficient_privilege THEN NULL;
   END;
  END LOOP;
  EXECUTE format('INSERT INTO public.%I(id,author_id,status,is_anonymous) VALUES (''55555555-5555-4555-8555-555555555555'',''44444444-4444-4444-8444-444444444444'',''pending'',true) RETURNING id',t);
  EXECUTE format('SELECT count(id) FROM public.%I WHERE status=''pending''',t) INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'owner read or insert returning regressed'; END IF;
 END LOOP;
END $test$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
 IF EXISTS(SELECT id FROM public.reviews) OR EXISTS(SELECT id FROM public.womens_team_reviews) THEN RAISE EXCEPTION 'anon visibility widened'; END IF;
 IF has_column_privilege(current_user,'public.reviews','author_id','SELECT') OR has_column_privilege(current_user,'public.womens_team_reviews','author_id','SELECT') THEN RAISE EXCEPTION 'anon author ACL survived'; END IF;
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ BEGIN
 IF (SELECT count(author_id) FROM public.reviews)<>3 OR (SELECT count(author_id) FROM public.womens_team_reviews)<>3 THEN RAISE EXCEPTION 'service attribution regressed'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: direct author-column ACL rehearsal; full caller compatibility remains open' AS result;
