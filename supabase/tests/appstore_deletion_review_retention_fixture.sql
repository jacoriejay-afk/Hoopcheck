-- Disposable synthetic PostgreSQL 17 fixture, not actual schema acceptance.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA hoopcheck_deletion_private;
GRANT USAGE ON SCHEMA hoopcheck_deletion_private TO service_role;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,player_verified boolean NOT NULL);
CREATE TABLE public.account_deletion_requests(id uuid PRIMARY KEY,user_id uuid NOT NULL);
CREATE TABLE hoopcheck_deletion_private.worker_state(request_id uuid PRIMARY KEY,policy_version text NOT NULL,next_step integer NOT NULL,fence uuid NOT NULL);
CREATE TABLE hoopcheck_deletion_private.frozen_accounts(owner_id uuid PRIMARY KEY,request_id uuid NOT NULL);
CREATE FUNCTION public.assert_account_deletion_worker(p_request uuid,p_owner uuid,p_fence uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.account_deletion_requests r JOIN hoopcheck_deletion_private.worker_state w ON w.request_id=r.id WHERE r.id=p_request AND r.user_id=p_owner AND w.fence=p_fence AND w.next_step=8)
$$;
CREATE TABLE public.reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 team_id uuid NOT NULL,overall_rating numeric NOT NULL,title text,body text NOT NULL,status text NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 is_anonymous boolean NOT NULL,player_season text,legal_review_required boolean NOT NULL DEFAULT false);
CREATE UNIQUE INDEX reviews_author_team_unique ON public.reviews(author_id,team_id);
CREATE TABLE public.womens_team_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 womens_team_id uuid NOT NULL,overall_rating numeric NOT NULL,title text,body text NOT NULL,status text NOT NULL,created_at timestamptz NOT NULL,is_anonymous boolean NOT NULL);
CREATE TABLE public.review_comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid REFERENCES public.reviews(id));
CREATE TABLE public.review_likes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid REFERENCES public.reviews(id));
CREATE TABLE public.review_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid REFERENCES public.reviews(id));
CREATE TABLE public.review_moderation_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid REFERENCES public.reviews(id));
CREATE TABLE public.moderation_risk_flags(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),content_type text,content_id uuid);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.womens_team_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_select ON public.reviews FOR SELECT TO authenticated USING(true);
CREATE POLICY test_select ON public.womens_team_reviews FOR SELECT TO authenticated USING(true);
GRANT SELECT(id,team_id,overall_rating,body,status,is_anonymous,created_at) ON public.reviews TO authenticated;
GRANT SELECT(id,womens_team_id,overall_rating,body,status,is_anonymous,created_at) ON public.womens_team_reviews TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.reviews,public.womens_team_reviews TO service_role;
CREATE POLICY test_service ON public.reviews FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE POLICY test_service ON public.womens_team_reviews FOR ALL TO service_role USING(true) WITH CHECK(true);
INSERT INTO public.profiles VALUES('11111111-1111-4111-8111-111111111111',true),('22222222-2222-4222-8222-222222222222',false);
INSERT INTO public.account_deletion_requests VALUES('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111');
INSERT INTO hoopcheck_deletion_private.worker_state VALUES('44444444-4444-4444-8444-444444444444','fixture',8,'55555555-5555-4555-8555-555555555555');
INSERT INTO hoopcheck_deletion_private.frozen_accounts VALUES('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444');
INSERT INTO public.reviews(id,author_id,team_id,overall_rating,title,body,status,created_at,updated_at,is_anonymous,player_season)
 VALUES('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',4,'Private title','Former owner private free text','approved','2026-11-21T13:14:15Z','2026-11-24T01:02:03Z',false,'2026'),
 ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',2,'Unrelated','Unrelated review body','approved','2026-11-20T00:00:00Z','2026-11-20T00:00:00Z',false,'2026');
INSERT INTO public.womens_team_reviews VALUES('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',5,'Private title','Former owner private free text','approved','2026-11-21T13:14:15Z',false);
\ir ../candidates/appstore_deletion_review_retention_review_only.sql
DO $$BEGIN
 BEGIN DELETE FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111'; RAISE EXCEPTION 'cascade remained possible'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO public.womens_team_reviews(author_id,womens_team_id,overall_rating,title,body,status,created_at,is_anonymous)
 VALUES('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',4,NULL,'duplicate content','approved',now(),false);
 RAISE EXCEPTION 'duplicate accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
END$$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',false);
DO $$BEGIN
 BEGIN PERFORM author_id FROM public.reviews; RAISE EXCEPTION 'author visible'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.womens_team_reviews; RAISE EXCEPTION 'wildcard visible'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.retain_approved_deletion_reviews('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',true); RAISE EXCEPTION 'caller invoked retention'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.get_retained_review_trust_facts('men',ARRAY['66666666-6666-4666-8666-666666666666'::uuid]); RAISE EXCEPTION 'caller read retained facts'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
DO $$BEGIN
 BEGIN PERFORM public.retain_approved_deletion_reviews('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',true); RAISE EXCEPTION 'disabled executed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.reviews SET author_id=NULL,id=gen_random_uuid(),is_anonymous=true,title=NULL,body='Rating retained after account deletion.',player_season='Season not recorded' WHERE id='66666666-6666-4666-8666-666666666666'; RAISE EXCEPTION 'direct transition allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
UPDATE hoopcheck_deletion_private.review_retention_config SET enabled=true;
SET ROLE service_role;
DO $$BEGIN
 BEGIN PERFORM public.retain_approved_deletion_reviews('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555',true); RAISE EXCEPTION 'cross-account effect'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.retain_approved_deletion_reviews('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',true); RAISE EXCEPTION 'unapproved effect'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
INSERT INTO public.review_comments(review_id) VALUES('66666666-6666-4666-8666-666666666666');
SET ROLE service_role;
DO $$BEGIN
 BEGIN PERFORM public.retain_approved_deletion_reviews('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',false); RAISE EXCEPTION 'dependent review eligible'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Review history requires separately approved disposition' THEN RAISE; END IF; END;
END$$;
RESET ROLE;
DELETE FROM public.review_comments WHERE review_id='66666666-6666-4666-8666-666666666666';
SELECT (public.retain_approved_deletion_reviews('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',false)->>'scope_digest') AS digest \gset
INSERT INTO hoopcheck_deletion_private.review_retention_approvals VALUES('44444444-4444-4444-8444-444444444444','fixture',:'digest',current_date+30,false,true);
SET ROLE service_role;
DO $$BEGIN
 BEGIN PERFORM public.retain_approved_deletion_reviews('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',true); RAISE EXCEPTION 'legal hold accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
UPDATE hoopcheck_deletion_private.review_retention_approvals SET legal_hold_cleared=true;
UPDATE public.reviews SET title='Changed after approval' WHERE id='66666666-6666-4666-8666-666666666666';
SET ROLE service_role;
DO $$BEGIN
 BEGIN PERFORM public.retain_approved_deletion_reviews('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',true); RAISE EXCEPTION 'stale scope accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
SELECT (public.retain_approved_deletion_reviews('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',false)->>'scope_digest') AS digest \gset
UPDATE hoopcheck_deletion_private.review_retention_approvals SET scope_digest=:'digest';
SET ROLE service_role;
DO $$DECLARE result jsonb;BEGIN
 result:=public.retain_approved_deletion_reviews('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',true);
 IF result IS DISTINCT FROM '{"ok":true,"retained_count":2}'::jsonb THEN RAISE EXCEPTION 'retention not confirmed'; END IF;
 IF public.retain_approved_deletion_reviews('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',true) IS DISTINCT FROM result THEN RAISE EXCEPTION 'retry duplicated'; END IF;
END$$;
RESET ROLE;
DO $$DECLARE mid uuid;wid uuid;BEGIN
 IF EXISTS(SELECT 1 FROM public.reviews WHERE id='66666666-6666-4666-8666-666666666666' OR author_id='11111111-1111-4111-8111-111111111111')
 OR EXISTS(SELECT 1 FROM public.womens_team_reviews WHERE id='77777777-7777-4777-8777-777777777777' OR author_id='11111111-1111-4111-8111-111111111111')
 OR (SELECT count(*) FROM public.reviews)<>2 OR (SELECT avg(overall_rating) FROM public.reviews)<>3
 OR (SELECT count(*) FROM public.womens_team_reviews)<>1 OR (SELECT avg(overall_rating) FROM public.womens_team_reviews)<>5
 OR NOT EXISTS(SELECT 1 FROM public.reviews WHERE id='88888888-8888-4888-8888-888888888888' AND author_id='22222222-2222-4222-8222-222222222222' AND overall_rating=2)
 THEN RAISE EXCEPTION 'rating or author preservation failed'; END IF;
 SELECT id INTO STRICT mid FROM public.reviews WHERE author_id IS NULL AND is_anonymous AND title IS NULL AND body='Rating retained after account deletion.' AND player_season='Season not recorded' AND created_at='2026-11-01T00:00:00Z';
 SELECT id INTO STRICT wid FROM public.womens_team_reviews WHERE author_id IS NULL AND is_anonymous AND title IS NULL AND body='Rating retained after account deletion.' AND created_at='2026-11-01T00:00:00Z';
 IF NOT EXISTS(SELECT 1 FROM public.get_retained_review_trust_facts('men',ARRAY[mid]) WHERE reviewer_verified)
 OR NOT EXISTS(SELECT 1 FROM public.get_retained_review_trust_facts('women',ARRAY[wid]) WHERE reviewer_verified)
 OR EXISTS(SELECT 1 FROM public.get_retained_review_trust_facts('men',ARRAY['66666666-6666-4666-8666-666666666666'::uuid,'88888888-8888-4888-8888-888888888888'::uuid]))
 OR EXISTS(SELECT 1 FROM hoopcheck_deletion_private.review_retention_approvals WHERE request_id='44444444-4444-4444-8444-444444444444')
 THEN RAISE EXCEPTION 'trust facts or approval cleanup failed'; END IF;
 BEGIN UPDATE public.reviews SET overall_rating=5 WHERE id=mid; RAISE EXCEPTION 'retained rating editable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.reviews SET status='removed' WHERE id=mid;
 IF EXISTS(SELECT 1 FROM public.get_retained_review_trust_facts('men',ARRAY[mid])) THEN RAISE EXCEPTION 'removed rating exposed'; END IF;
 DELETE FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111';
 IF (SELECT count(*) FROM public.womens_team_reviews)<>1 OR (SELECT count(*) FROM public.reviews)<>2 THEN RAISE EXCEPTION 'profile removal lost retained rows'; END IF;
END$$;
\echo PASS: both review tables, protected identity detachment, exact approval, legal hold, stable rating counts, trust facts and idempotent retry
