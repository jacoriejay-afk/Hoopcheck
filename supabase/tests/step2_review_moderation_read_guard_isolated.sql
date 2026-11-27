\set ON_ERROR_STOP on
-- Synthetic model of the observed permissive policies, not a production clone.
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
CREATE TABLE public.reviews(id int PRIMARY KEY, author_id uuid NOT NULL,status text NOT NULL);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.reviews TO anon, authenticated;
CREATE POLICY "reviews paid read guard" ON public.reviews FOR SELECT TO anon,authenticated
USING (auth.uid() IS NOT NULL AND (author_id=auth.uid() OR private.is_admin_or_moderator() OR private.is_active_subscriber()));
CREATE POLICY reviews_subscriber_read ON public.reviews FOR SELECT TO authenticated
USING ((status='approved' AND private.is_active_subscriber()) OR author_id=auth.uid() OR private.is_admin_or_moderator());
INSERT INTO public.reviews VALUES
(1,'11111111-1111-4111-8111-111111111111','approved'),
(2,'11111111-1111-4111-8111-111111111111','pending'),
(3,'11111111-1111-4111-8111-111111111111','rejected');
COMMIT;
SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
SET fixture.paid='yes';
DO $$ BEGIN IF (SELECT count(*) FROM public.reviews)<>3 THEN RAISE EXCEPTION 'fixture did not reproduce permissive bypass'; END IF; END $$;
RESET ROLE;
\ir ../candidates/step2_review_moderation_read_guard_review_only.sql
SET ROLE authenticated;
DO $$ BEGIN IF (SELECT array_agg(id ORDER BY id) FROM public.reviews) IS DISTINCT FROM ARRAY[1] THEN RAISE EXCEPTION 'paid reader sees nonapproved reviews'; END IF; END $$;
SET fixture.paid='no';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.reviews) THEN RAISE EXCEPTION 'unpaid reader granted access'; END IF; END $$;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $$ BEGIN IF (SELECT count(*) FROM public.reviews)<>3 THEN RAISE EXCEPTION 'author access regressed'; END IF; END $$;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
SET fixture.mod='yes';
DO $$ BEGIN IF (SELECT count(*) FROM public.reviews)<>3 THEN RAISE EXCEPTION 'moderator access regressed'; END IF; END $$;
RESET ROLE;
SET ROLE anon;
SET request.jwt.claim.sub='';
SET fixture.mod='no';
SET fixture.paid='no';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.reviews) THEN RAISE EXCEPTION 'anonymous reader granted access'; END IF; END $$;
RESET ROLE;
SELECT 'PASS: restrictive moderation visibility guard, synthetic roles only' AS result;
