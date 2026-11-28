-- HoopCheck Step 2: fail-closed synthetic acceptance harness.
-- Derived from supplied part1/part2. NOT a migration. Never run on hosted or production databases.
-- Run ONLY on an independently verified disposable local PostgreSQL 17 schema restoration.
-- Example: psql -X -v HOOPCHECK_LOCAL_ACCEPTANCE=on -d hoopcheck_step2_acceptance -f step2-acceptance-hardened.sql
-- The database name/loopback checks are extra guardrails, not proof of isolation (e.g. tunnels).
-- An error stops psql; closing the connection rolls the transaction back. Do not run interactively.
\set ON_ERROR_STOP on
\if :{?HOOPCHECK_LOCAL_ACCEPTANCE}
  \if :HOOPCHECK_LOCAL_ACCEPTANCE
  \else
    DO $$ BEGIN RAISE EXCEPTION 'Explicit local acceptance opt-in required'; END $$;
  \endif
\else
  DO $$ BEGIN RAISE EXCEPTION 'Explicit local acceptance opt-in required'; END $$;
\endif
BEGIN;
DO $guard$
BEGIN
  IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN
    RAISE EXCEPTION 'PostgreSQL 17 required for the reviewed baseline';
  END IF;
  IF current_database() <> 'hoopcheck_step2_acceptance' OR
     (inet_server_addr() IS NOT NULL AND inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)) THEN
    RAISE EXCEPTION 'Refusing non-local or incorrectly named database';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users) OR EXISTS (SELECT 1 FROM public.profiles)
     OR EXISTS (SELECT 1 FROM public.reviews) OR EXISTS (SELECT 1 FROM public.review_comments)
     OR EXISTS (SELECT 1 FROM public.review_likes) OR EXISTS (SELECT 1 FROM public.notifications)
     OR EXISTS (SELECT 1 FROM public.subscriptions) OR EXISTS (SELECT 1 FROM public.admin_roles)
     OR EXISTS (SELECT 1 FROM public.leagues WHERE id IN ('55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666','77777777-7777-7777-7777-777777777777')) THEN
    RAISE EXCEPTION 'Refusing nonempty fixture tables or colliding league IDs';
  END IF;
END
$guard$;
-- HoopCheck Step 2 acceptance tests, part 1 (LOCAL synthetic data only; run as supabase_admin)
-- A = verified player + premium active subscriber
-- B = verified player, no subscription
-- C = fan, no subscription
-- D = admin (admin_roles)
-- Setup (local administrative test role; RLS bypassed)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, aud, role, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) VALUES
 ('11111111-1111-1111-1111-111111111111','acceptance-a@example.invalid','x',now(),'authenticated','authenticated',now(),now(),'{"provider":"email"}', '{"account_type":"player","gender":"male","birthdate":"1990-01-01","username":"acceptance_a","position":"PG","years_pro":"5","professional_experience":"true","agreed_to_terms":"true","terms_accepted_at":"2026-11-28T00:00:00Z","terms_version":"1","full_name":"Acceptance A"}'),
 ('22222222-2222-2222-2222-222222222222','acceptance-b@example.invalid','x',now(),'authenticated','authenticated',now(),now(),'{"provider":"email"}', '{"account_type":"player","gender":"male","birthdate":"1990-01-01","username":"acceptance_b","position":"PG","years_pro":"5","professional_experience":"true","agreed_to_terms":"true","terms_accepted_at":"2026-11-28T00:00:00Z","terms_version":"1","full_name":"Acceptance B"}'),
 ('33333333-3333-3333-3333-333333333333','acceptance-c@example.invalid','x',now(),'authenticated','authenticated',now(),now(),'{"provider":"email"}', '{"account_type":"fan","gender":"female","birthdate":"1990-01-01","username":"acceptance_c","position":"PG","years_pro":"0","professional_experience":"false","agreed_to_terms":"true","terms_accepted_at":"2026-11-28T00:00:00Z","terms_version":"1","full_name":"Acceptance C"}'),
 ('44444444-4444-4444-4444-444444444444','acceptance-d@example.invalid','x',now(),'authenticated','authenticated',now(),now(),'{"provider":"email"}', '{"account_type":"player","gender":"male","birthdate":"1990-01-01","username":"acceptance_d","position":"PG","years_pro":"5","professional_experience":"true","agreed_to_terms":"true","terms_accepted_at":"2026-11-28T00:00:00Z","terms_version":"1","full_name":"Acceptance D"}');
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
  IF n IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'setup auth.users rows: expected 4, got %', n;
  END IF;
  RAISE NOTICE 'PASS: setup auth.users rows';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
  IF n IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'setup auto profiles: expected 4, got %', n;
  END IF;
  RAISE NOTICE 'PASS: setup auto profiles';
END
$check$;
INSERT INTO public.leagues (id, name) VALUES ('55555555-5555-5555-5555-555555555555', 'Acceptance Test League') ;
INSERT INTO public.leagues (id, name) VALUES ('66666666-6666-6666-6666-666666666666', 'Acceptance Test League 2') ;
INSERT INTO public.leagues (id, name) VALUES ('77777777-7777-7777-7777-777777777777', 'Acceptance Test League 3') ;
-- Fixture updates run under the schema's own service_role bypass (prevent_user_privileged_profile_fields returns NEW for service_role; a bare superuser has no JWT, so auth.uid() is NULL and the trigger raises 'Authentication required').
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
UPDATE public.profiles SET account_type='player', player_verified=true, profile_visibility='public' WHERE id='11111111-1111-1111-1111-111111111111';
UPDATE public.profiles SET account_type='player', player_verified=true, profile_visibility='private' WHERE id='22222222-2222-2222-2222-222222222222';
UPDATE public.profiles SET account_type='fan', player_verified=false, profile_visibility='public' WHERE id='33333333-3333-3333-3333-333333333333';
UPDATE public.profiles SET account_type='player', player_verified=true, profile_visibility='public' WHERE id='44444444-4444-4444-4444-444444444444';
RESET ROLE;
RESET request.jwt.claims;
INSERT INTO public.admin_roles (user_id, role) VALUES ('44444444-4444-4444-4444-444444444444','admin');
INSERT INTO public.subscriptions (user_id, plan, status, current_period_end, access_status) VALUES ('11111111-1111-1111-1111-111111111111','premium','active', now() + interval '30 days','premium');
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.subscriptions WHERE user_id='11111111-1111-1111-1111-111111111111';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'setup subscription A: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: setup subscription A';
END
$check$;
-- Fixture test; transaction is rolled back at end.
-- Fixture test; transaction is rolled back at end.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}';
INSERT INTO public.reviews (author_id, league_id, overall_rating, title, body, status)
VALUES ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 4, 'Acceptance test review A', 'ACCEPTANCE-TEST-REVIEW-A body text.', 'pending');
RESET ROLE;
RESET request.jwt.claims;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE title='Acceptance test review A';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T1a A insert: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T1a A insert';
END
$check$;
-- Fixture test; transaction is rolled back at end.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aud":"authenticated"}';
DO $deny$
BEGIN
  BEGIN
    INSERT INTO public.reviews (author_id, league_id, overall_rating, title, body, status)
    VALUES ('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 4, 'Acceptance test review B direct', 'ACCEPTANCE-TEST-REVIEW-B-DIRECT body.', 'pending');
    RAISE EXCEPTION 'Unexpected permitted write: Acceptance test review B direct';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$deny$;
RESET ROLE;
RESET request.jwt.claims;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE title='Acceptance test review B direct';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T1b B direct insert rows: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T1b B direct insert rows';
END
$check$;
-- Fixture test; transaction is rolled back at end.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aud":"authenticated"}';
DO $deny$
BEGIN
  BEGIN
    INSERT INTO public.reviews (author_id, league_id, overall_rating, title, body, status)
    VALUES ('33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555', 4, 'Acceptance test review C direct', 'ACCEPTANCE-TEST-REVIEW-C-DIRECT body.', 'pending');
    RAISE EXCEPTION 'Unexpected permitted write: Acceptance test review C direct';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$deny$;
RESET ROLE;
RESET request.jwt.claims;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE title='Acceptance test review C direct';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T1c C direct insert rows: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T1c C direct insert rows';
END
$check$;
-- Fixture test; transaction is rolled back at end.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}';
DO $deny$
BEGIN
  BEGIN
    INSERT INTO public.reviews (author_id, league_id, overall_rating, title, body, status)
    VALUES ('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 4, 'Acceptance test review wrong author', 'ACCEPTANCE-TEST-REVIEW-WRONG-AUTHOR body.', 'pending');
    RAISE EXCEPTION 'Unexpected permitted write: Acceptance test review wrong author';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$deny$;
RESET ROLE;
RESET request.jwt.claims;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE title='Acceptance test review wrong author';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T1d wrong-author insert rows: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T1d wrong-author insert rows';
END
$check$;
-- Moderate A's review to approved (superuser bypasses RLS)
UPDATE public.reviews SET status='approved' WHERE title='Acceptance test review A';
-- B's reviews: superuser insert with B's JWT claims set so the insert trigger sees uid()=B
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aud":"authenticated"}';
INSERT INTO public.reviews (author_id, league_id, overall_rating, title, body, status)
VALUES ('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 5, 'Acceptance test review B approved', 'ACCEPTANCE-TEST-REVIEW-B-APPROVED body.', 'approved');
INSERT INTO public.reviews (author_id, league_id, overall_rating, title, body, status)
VALUES ('22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666666', 2, 'Acceptance test review B rejected', 'ACCEPTANCE-TEST-REVIEW-B-REJECTED body.', 'rejected');
RESET request.jwt.claims;
-- A second review by A, stays pending
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}';
INSERT INTO public.reviews (author_id, league_id, overall_rating, title, body, status)
VALUES ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 3, 'Acceptance test review A pending', 'ACCEPTANCE-TEST-REVIEW-A-PENDING body.', 'pending');
RESET ROLE;
RESET request.jwt.claims;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE title LIKE 'Acceptance test review%';
  IF n IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'setup reviews: expected 4, got %', n;
  END IF;
  RAISE NOTICE 'PASS: setup reviews';
END
$check$;
-- Comments / likes / notification for cascade test (superuser bypass)
INSERT INTO public.review_comments (review_id, author_id, body) VALUES ((SELECT id FROM public.reviews WHERE title='Acceptance test review A'), '22222222-2222-2222-2222-222222222222', 'ACCEPTANCE-TEST-COMMENT-B on A review');
INSERT INTO public.review_comments (review_id, author_id, body) VALUES ((SELECT id FROM public.reviews WHERE title='Acceptance test review B approved'), '11111111-1111-1111-1111-111111111111', 'ACCEPTANCE-TEST-COMMENT-A on B review');
INSERT INTO public.review_likes (review_id, user_id) VALUES ((SELECT id FROM public.reviews WHERE title='Acceptance test review A'), '22222222-2222-2222-2222-222222222222');
INSERT INTO public.review_likes (review_id, user_id) VALUES ((SELECT id FROM public.reviews WHERE title='Acceptance test review B approved'), '11111111-1111-1111-1111-111111111111');
INSERT INTO public.notifications (user_id, target_type, target_id, notification_type, title, body) VALUES ('22222222-2222-2222-2222-222222222222', 'league', '55555555-5555-5555-5555-555555555555', 'review', 'Acceptance notification B', 'ACCEPTANCE-TEST-NOTIFICATION-B body');
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_comments WHERE body LIKE 'ACCEPTANCE-TEST-COMMENT%';
  IF n IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'setup comments: expected 2, got %', n;
  END IF;
  RAISE NOTICE 'PASS: setup comments';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_likes WHERE review_id IN (SELECT id FROM public.reviews WHERE title LIKE 'Acceptance test review%');
  IF n IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'setup likes: expected 2, got %', n;
  END IF;
  RAISE NOTICE 'PASS: setup likes';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.notifications WHERE user_id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'setup notifications B: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: setup notifications B';
END
$check$;
INSERT INTO public.review_comments (review_id, author_id, body) VALUES ((SELECT id FROM public.reviews WHERE title='Acceptance test review A'), '44444444-4444-4444-4444-444444444444', 'ACCEPTANCE-CONTROL-COMMENT-D');
INSERT INTO public.review_likes (review_id, user_id) VALUES ((SELECT id FROM public.reviews WHERE title='Acceptance test review A'), '44444444-4444-4444-4444-444444444444');
INSERT INTO public.notifications (user_id, target_type, target_id, notification_type, title, body) VALUES ('11111111-1111-1111-1111-111111111111', 'league', '55555555-5555-5555-5555-555555555555', 'review', 'Acceptance notification A control', 'ACCEPTANCE-CONTROL-NOTIFICATION-A');
-- ============ TEST 1: REVIEW READ ACCESS ============
-- T1.1 anon (expect 0)
SET LOCAL ROLE anon;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews;
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T1.1 anon reviews visible: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T1.1 anon reviews visible';
END
$check$;
RESET ROLE;
RESET request.jwt.claims;
-- T1.2 B non-subscriber (expect 2: own approved + own rejected)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aud":"authenticated"}';
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews;
  IF n IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'T1.2 B reviews visible: expected 2, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T1.2 B reviews visible';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE status='approved';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T1.2b B approved visible: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T1.2b B approved visible';
END
$check$;
RESET ROLE;
RESET request.jwt.claims;
-- T1.3 A subscriber (expect 3: own approved, own pending, B approved)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}';
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews;
  IF n IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'T1.3 A reviews visible: expected 3, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T1.3 A reviews visible';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE status='approved';
  IF n IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'T1.3b A approved visible: expected 2, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T1.3b A approved visible';
END
$check$;
RESET ROLE;
RESET request.jwt.claims;
-- T1.4 C fan non-subscriber (expect 0)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aud":"authenticated"}';
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews;
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T1.4 C reviews visible: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T1.4 C reviews visible';
END
$check$;
RESET ROLE;
RESET request.jwt.claims;
-- T1.5 D admin (expect 4)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","aud":"authenticated"}';
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews;
  IF n IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'T1.5 D admin reviews visible: expected 4, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T1.5 D admin reviews visible';
END
$check$;
RESET ROLE;
RESET request.jwt.claims;
-- ============ TEST 2: ACCOUNT ISOLATION ============
-- T2.1 A reads B's private profile (expect 0)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}';
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T2.1 A reads B private profile: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T2.1 A reads B private profile';
END
$check$;
RESET ROLE;
RESET request.jwt.claims;
-- T2.2 A updates B's profile (expect UPDATE 0)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}';
DO $update$
DECLARE n bigint;
BEGIN
  UPDATE public.profiles SET username='acceptance-hijack' WHERE id='22222222-2222-2222-2222-222222222222';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'T2.2 unauthorized update touched % rows', n; END IF;
END
$update$;
RESET ROLE;
RESET request.jwt.claims;
-- T2.3 B reads own profile (expect 1)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aud":"authenticated"}';
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T2.3 B reads own profile: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T2.3 B reads own profile';
END
$check$;
RESET ROLE;
RESET request.jwt.claims;
-- T2.4 anon reads B's private profile (expect 0)
SET LOCAL ROLE anon;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T2.4 anon reads B private profile: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T2.4 anon reads B private profile';
END
$check$;
RESET ROLE;
RESET request.jwt.claims;
-- ============ TEST 5 (read part): USER DATA EXPORT VIA READ QUERIES ============
-- T5.1 B exports own data via read queries
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aud":"authenticated"}';
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE author_id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'T5.1 B own reviews exportable: expected 2, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T5.1 B own reviews exportable';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T5.2 B own profile exportable: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T5.2 B own profile exportable';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.subscriptions WHERE user_id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T5.3 B own subscription rows: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T5.3 B own subscription rows';
END
$check$;
RESET ROLE;
RESET request.jwt.claims;
-- Final state summary (superuser)
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE title LIKE 'Acceptance test review%';
  IF n IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'final reviews: expected 4, got %', n;
  END IF;
  RAISE NOTICE 'PASS: final reviews';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
  IF n IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'final profiles: expected 4, got %', n;
  END IF;
  RAISE NOTICE 'PASS: final profiles';
END
$check$;

-- HoopCheck Step 2 acceptance tests, part 2 - Test 3: deletion cascade (synthetic user B).
-- Pre-condition: acceptance-tests-part1.sql populated four synthetic users A-D.
-- B = 22222222-2222-2222-2222-222222222222 (verified player, private profile, 2 reviews).
-- Expected: deleting auth.users B cascades to B's profile, B's reviews, comments by/on B,
-- likes by/on B, and notifications for B. A's data and the synthetic leagues must survive.
-- All FKs involved are ON DELETE CASCADE (see worklog); profiles' optional references are SET NULL.
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM auth.users WHERE id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T3.0 B auth user: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 B auth user';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T3.0 B profile: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 B profile';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE author_id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'T3.0 B reviews: expected 2, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 B reviews';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_comments WHERE author_id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T3.0 comments by B: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 comments by B';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_comments WHERE review_id IN (SELECT id FROM public.reviews WHERE author_id='22222222-2222-2222-2222-222222222222');
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T3.0 comments on B reviews: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 comments on B reviews';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_likes WHERE user_id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T3.0 likes by B: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 likes by B';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_likes WHERE review_id IN (SELECT id FROM public.reviews WHERE author_id='22222222-2222-2222-2222-222222222222');
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T3.0 likes on B reviews: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 likes on B reviews';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.notifications WHERE user_id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T3.0 notifications for B: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 notifications for B';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE author_id='11111111-1111-1111-1111-111111111111';
  IF n IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'T3.0 A reviews (control): expected 2, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 A reviews (control)';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_comments;
  IF n IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'T3.0 total comments: expected 3, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 total comments';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_likes;
  IF n IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'T3.0 total likes: expected 3, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 total likes';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.notifications;
  IF n IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'T3.0 total notifications: expected 2, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 total notifications';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.leagues WHERE id IN ('55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666','77777777-7777-7777-7777-777777777777');
  IF n IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'T3.0 leagues: expected 3, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.0 leagues';
END
$check$;
CREATE TEMP TABLE acceptance_deleted_review_ids ON COMMIT DROP AS
SELECT id FROM public.reviews WHERE author_id='22222222-2222-2222-2222-222222222222';
DO $capture$ BEGIN IF (SELECT count(*) FROM acceptance_deleted_review_ids) <> 2 THEN RAISE EXCEPTION 'Expected two saved review IDs'; END IF; END $capture$;
DELETE FROM auth.users WHERE id='22222222-2222-2222-2222-222222222222';
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM auth.users WHERE id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T3.2 B auth user: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 B auth user';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T3.2 B profile: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 B profile';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE author_id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T3.2 B reviews: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 B reviews';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_comments WHERE author_id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T3.2 comments by B: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 comments by B';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_comments WHERE review_id IN (SELECT id FROM acceptance_deleted_review_ids);
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T3.2 comments on B reviews: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 comments on B reviews';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_likes WHERE user_id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T3.2 likes by B: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 likes by B';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_likes WHERE review_id IN (SELECT id FROM acceptance_deleted_review_ids);
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T3.2 likes on B reviews: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 likes on B reviews';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.notifications WHERE user_id='22222222-2222-2222-2222-222222222222';
  IF n IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T3.2 notifications for B: expected 0, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 notifications for B';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.reviews WHERE author_id='11111111-1111-1111-1111-111111111111';
  IF n IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'T3.2 A reviews (control): expected 2, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 A reviews (control)';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_comments;
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T3.2 total comments: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 total comments';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_likes;
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T3.2 total likes: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 total likes';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.notifications;
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'T3.2 total notifications: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 total notifications';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.leagues WHERE id IN ('55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666','77777777-7777-7777-7777-777777777777');
  IF n IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'T3.2 leagues: expected 3, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 leagues';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id IN ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
  IF n IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'T3.2 remaining profiles: expected 3, got %', n;
  END IF;
  RAISE NOTICE 'PASS: T3.2 remaining profiles';
END
$check$;

DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_comments WHERE author_id='44444444-4444-4444-4444-444444444444' AND body='ACCEPTANCE-CONTROL-COMMENT-D' AND review_id IN (SELECT id FROM public.reviews WHERE author_id='11111111-1111-1111-1111-111111111111');
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'control comment survives: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: control comment survives';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.review_likes WHERE user_id='44444444-4444-4444-4444-444444444444' AND review_id IN (SELECT id FROM public.reviews WHERE title='Acceptance test review A');
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'control like survives: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: control like survives';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.notifications WHERE user_id='11111111-1111-1111-1111-111111111111' AND title='Acceptance notification A control';
  IF n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'control notification survives: expected 1, got %', n;
  END IF;
  RAISE NOTICE 'PASS: control notification survives';
END
$check$;
DO $check$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
  IF n IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'control auth users survive: expected 3, got %', n;
  END IF;
  RAISE NOTICE 'PASS: control auth users survive';
END
$check$;

ROLLBACK;
BEGIN READ ONLY;
DO $rollback_check$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users) OR EXISTS (SELECT 1 FROM public.profiles)
     OR EXISTS (SELECT 1 FROM public.reviews) OR EXISTS (SELECT 1 FROM public.review_comments)
     OR EXISTS (SELECT 1 FROM public.review_likes) OR EXISTS (SELECT 1 FROM public.notifications)
     OR EXISTS (SELECT 1 FROM public.subscriptions) OR EXISTS (SELECT 1 FROM public.admin_roles)
     OR EXISTS (SELECT 1 FROM public.leagues WHERE id IN ('55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666','77777777-7777-7777-7777-777777777777')) THEN
    RAISE EXCEPTION 'Rollback read-back did not match the empty fixture preconditions';
  END IF;
END
$rollback_check$;
ROLLBACK;
\echo PASS: all assertions completed; fixture transaction rolled back and empty fixture tables verified.
