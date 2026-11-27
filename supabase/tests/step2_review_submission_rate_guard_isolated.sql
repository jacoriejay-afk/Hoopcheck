\set ON_ERROR_STOP on
-- Run on a fresh, disposable cluster. Creates synthetic profiles and reviews.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email_confirmed_at timestamptz);
CREATE TABLE public.profiles(id uuid REFERENCES auth.users, moderation_status text);
CREATE TABLE public.reviews(id integer PRIMARY KEY, author_id uuid NOT NULL REFERENCES auth.users, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.womens_team_reviews(LIKE public.reviews INCLUDING ALL);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.womens_team_reviews ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.reviews, public.womens_team_reviews TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE POLICY fixture_insert ON public.reviews FOR INSERT TO authenticated WITH CHECK (author_id=auth.uid());
CREATE POLICY fixture_insert ON public.womens_team_reviews FOR INSERT TO authenticated WITH CHECK (author_id=auth.uid());

INSERT INTO auth.users VALUES
 ('11111111-1111-4111-8111-111111111111',now()),
 ('22222222-2222-4222-8222-222222222222',now()),
 ('33333333-3333-4333-8333-333333333333',now()),
 ('44444444-4444-4444-8444-444444444444',null),
 ('55555555-5555-4555-8555-555555555555',now());
INSERT INTO public.profiles SELECT id,CASE WHEN id::text LIKE '333%' THEN 'suspended' ELSE 'normal' END FROM auth.users;
INSERT INTO public.reviews VALUES
 (1,'11111111-1111-4111-8111-111111111111',now()-interval '23 hours'),
 (2,'11111111-1111-4111-8111-111111111111',now()-interval '25 hours');

\ir ../candidates/step2_review_submission_rate_guard_review_only.sql

SET ROLE authenticated;
SET request.jwt.claims = '{"role":"authenticated"}';
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
INSERT INTO reviews(id,author_id) VALUES(3,auth.uid()),(4,auth.uid());
INSERT INTO womens_team_reviews(id,author_id) VALUES(5,auth.uid()),(6,auth.uid());
DO $$ BEGIN
 BEGIN
  INSERT INTO reviews(id,author_id,created_at) VALUES(7,auth.uid(),now()-interval '2 days');
  RAISE EXCEPTION 'Combined quota was exceeded';
 EXCEPTION WHEN SQLSTATE 'PT429' THEN NULL;
 END;
 BEGIN
  PERFORM accepted_at FROM hoopcheck_review_security.submission_windows;
  RAISE EXCEPTION 'Direct quota access was granted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;

SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
DO $$ BEGIN
 BEGIN
  INSERT INTO womens_team_reviews(id,author_id) VALUES(8,auth.uid());
  RAISE EXCEPTION 'Roll back attempted submission' USING ERRCODE='P0002';
 EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
 END;
END $$;
INSERT INTO womens_team_reviews(id,author_id) SELECT id,auth.uid() FROM generate_series(8,12) id;

SET request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
DO $$ BEGIN
 BEGIN
  INSERT INTO reviews(id,author_id) VALUES(13,auth.uid());
  RAISE EXCEPTION 'Suspended account submitted a review';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
DO $$ BEGIN
 BEGIN
  INSERT INTO womens_team_reviews(id,author_id) VALUES(14,auth.uid());
  RAISE EXCEPTION 'Unconfirmed account submitted a review';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;

RESET ROLE;
UPDATE hoopcheck_review_security.submission_windows SET accepted_at=ARRAY[now()-interval '25 hours']
WHERE author_id='11111111-1111-4111-8111-111111111111';
SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
INSERT INTO reviews(id,author_id) VALUES(15,auth.uid());
RESET ROLE;
DO $$ BEGIN
 IF (SELECT cardinality(accepted_at) FROM hoopcheck_review_security.submission_windows WHERE author_id='11111111-1111-4111-8111-111111111111')<>1 THEN
  RAISE EXCEPTION 'Expired entries were not pruned';
 END IF;
END $$;
SELECT 'PASS: combined rolling review limits, caller eligibility, rollback, and private quota' AS result;
