\set ON_ERROR_STOP on
-- Synthetic rollback-only proof following step2_review_baseline_policy_shape_isolated.sql.
-- NOT a migration. Do not run against a hosted database or existing application tables.
BEGIN;
DO $guard$
BEGIN
 IF current_database() <> 'hoopcheck_review_baseline_fixture' OR inet_server_addr() IS NOT NULL
 THEN RAISE EXCEPTION 'Refusing non-fixture database'; END IF;
 IF (SELECT count(*) FROM public.reviews) <> 3 OR
    (SELECT count(*) FROM public.womens_team_reviews) <> 3
 THEN RAISE EXCEPTION 'Expected synthetic review fixture'; END IF;
END $guard$;
-- Model residual column-specific privileges as well as the broad table ACL.
GRANT SELECT(author_id) ON public.reviews,public.womens_team_reviews TO authenticated;
REVOKE SELECT ON public.reviews,public.womens_team_reviews FROM PUBLIC,anon,authenticated;
REVOKE SELECT(author_id) ON public.reviews,public.womens_team_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,status,is_anonymous) ON public.reviews,public.womens_team_reviews TO anon,authenticated;
DO $acl$
DECLARE r text; t text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH t IN ARRAY ARRAY['public.reviews','public.womens_team_reviews'] LOOP
   IF has_table_privilege(r,t,'SELECT') OR has_column_privilege(r,t,'author_id','SELECT')
      OR NOT has_column_privilege(r,t,'id','SELECT')
   THEN RAISE EXCEPTION 'Unexpected effective review ACL'; END IF;
  END LOOP;
 END LOOP;
END $acl$;
-- All previously tested permitted row counts must remain intact.
SET LOCAL ROLE authenticated;
SELECT public.fixture_matrix();
-- Paid non-owner: permitted review columns remain readable, even for anonymous rows.
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
SELECT set_config('fixture.paid','yes',false);
SELECT set_config('fixture.mod','no',false);
DO $visible$
BEGIN
 IF NOT EXISTS(SELECT id,status,is_anonymous FROM public.reviews WHERE is_anonymous)
 OR NOT EXISTS(SELECT id,status,is_anonymous FROM public.womens_team_reviews WHERE is_anonymous)
 THEN RAISE EXCEPTION 'Allowed anonymous review missing'; END IF;
END $visible$;
-- Deny raw author, predicates, ordering, aggregates and whole-row projections.
-- This also intentionally blocks direct owner and moderator reads of author_id;
-- compatible dedicated owner/moderator access is a separate rollout prerequisite.
DO $deny$
DECLARE t text; q text; actor text;
BEGIN
 FOREACH actor IN ARRAY ARRAY['reader','owner','moderator'] LOOP
  PERFORM set_config('request.jwt.claim.sub',CASE WHEN actor='owner' THEN
    '11111111-1111-4111-8111-111111111111' ELSE '22222222-2222-4222-8222-222222222222' END,false);
  PERFORM set_config('fixture.mod',CASE WHEN actor='moderator' THEN 'yes' ELSE 'no' END,false);
  FOREACH t IN ARRAY ARRAY['public.reviews','public.womens_team_reviews'] LOOP
   FOREACH q IN ARRAY ARRAY[
    format('SELECT author_id FROM %s',t),
    format('SELECT id FROM %s WHERE author_id = auth.uid()',t),
    format('SELECT id FROM %s ORDER BY author_id',t),
    format('SELECT count(author_id) FROM %s',t),
    format('SELECT * FROM %s',t),
    format('SELECT to_jsonb(r) FROM %s r',t)
   ] LOOP
    BEGIN
     EXECUTE q;
     RAISE EXCEPTION 'Sensitive projection unexpectedly permitted: %',q;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
   END LOOP;
  END LOOP;
 END LOOP;
END $deny$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',false);
SELECT set_config('fixture.mod','no',false);
SELECT public.fixture_expect(0,0);
DO $anon$
BEGIN
 BEGIN PERFORM author_id FROM public.reviews; RAISE EXCEPTION 'Anonymous author read permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM author_id FROM public.womens_team_reviews; RAISE EXCEPTION 'Anonymous author read permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anon$;
RESET ROLE;
ROLLBACK;
-- Prove grant changes did not persist, including the fixture's original author exposure.
DO $restored$
BEGIN
 IF NOT has_table_privilege('authenticated','public.reviews','SELECT')
 OR NOT has_column_privilege('authenticated','public.womens_team_reviews','author_id','SELECT')
 THEN RAISE EXCEPTION 'Synthetic ACL rollback failed'; END IF;
END $restored$;
SELECT 'PASS: synthetic column-grant privacy boundary, row matrix and rollback; production remediation not authorized' AS result;
