-- Appended ONLY inside the existing actual-schema runner's seeded transaction.
-- No transaction control, synthetic roles or replacement tables here.
-- The runner verifies an empty disposable PG17 restore, exact SHA, image,
-- schema/ledger hashes and all 57 baseline tests before reaching this phase.
DO $guard$ BEGIN
 IF current_database()<>'hoopcheck_step2_acceptance' OR inet_server_addr() IS NOT NULL
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR current_user<>'supabase_admin' OR (SELECT count(*) FROM auth.users)<>4
 THEN RAISE EXCEPTION 'Actual privacy acceptance requires original disposable seed'; END IF;
 IF EXISTS(SELECT FROM hoopcheck_export_private.policy WHERE enabled)
 OR EXISTS(SELECT FROM hoopcheck_export_private.media_policy WHERE enabled)
 OR EXISTS(SELECT FROM hoopcheck_deletion_private.review_retention_config WHERE enabled OR expiry_enabled)
 OR EXISTS(SELECT FROM hoopcheck_deletion_private.auth_revocation_config WHERE enabled)
 OR EXISTS(SELECT FROM hoopcheck_deletion_private.worker_config WHERE worker_enabled)
 THEN RAISE EXCEPTION 'Candidate active by default'; END IF;
 IF has_function_privilege('authenticated','public.resolve_account_export_media(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.retain_approved_deletion_reviews(uuid,uuid,uuid,boolean)','EXECUTE')
 OR has_function_privilege('authenticated','public.revoke_approved_deletion_auth_sessions(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.scrub_approved_deletion_exports(uuid,uuid,uuid)','EXECUTE')
 OR has_table_privilege('authenticated','hoopcheck_export_private.records','SELECT')
 THEN RAISE EXCEPTION 'Private worker or export data exposed'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='public.profiles'::regclass AND confdeltype='r' AND
 (conrelid,conname) IN (('public.reviews'::regclass,'reviews_author_id_fkey'),('public.womens_team_reviews'::regclass,'womens_team_reviews_author_id_fkey')))<>2
 THEN RAISE EXCEPTION 'Review author FK protection absent'; END IF;
END $guard$;

-- Scoped test-only configuration inside the rollback transaction.
UPDATE hoopcheck_export_private.policy SET enabled=true,scope_version='owned-records-v1',download_ttl=interval '1 hour',
 max_attempts=2,retry_delay=interval '1 second',request_interval=interval '1 second',max_rows=1000;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims='{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2","session_id":"a1111111-1111-4111-8111-111111111111"}';
DO $export$ BEGIN
 IF public.account_export_job('request','d1111111-1111-4111-8111-111111111111')->>'state'<>'queued' THEN RAISE EXCEPTION 'Actual export queue failed'; END IF;
END $export$;
RESET ROLE;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims='{"role":"service_role"}';
DO $worker$ BEGIN
 IF public.run_account_export_worker()<>'ready' THEN RAISE EXCEPTION 'Actual export projection failed; inspect schema or policy compatibility'; END IF;
END $worker$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims='{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2","session_id":"a1111111-1111-4111-8111-111111111111"}';
DO $page$ DECLARE p jsonb; BEGIN
 p:=public.account_export_job('download','d1111111-1111-4111-8111-111111111111');
 IF p->>'complete'<>'false' OR jsonb_array_length(p->'rows')<1
 OR p::text LIKE '%author_id%' OR p::text LIKE '%stripe_customer_id%'
 OR p::text LIKE '%ACCEPTANCE-TEST-REVIEW-B-APPROVED%' OR p::text LIKE '%ACCEPTANCE-TEST-REVIEW-B-REJECTED%'
 THEN RAISE EXCEPTION 'Actual export isolation or projection failed'; END IF;
END $page$;
SET LOCAL request.jwt.claims='{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1","session_id":"b2222222-2222-4222-8222-222222222222"}';
DO $other$ BEGIN
 BEGIN PERFORM public.account_export_job('download','d1111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'Foreign export accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $other$;
RESET ROLE;
RESET request.jwt.claims;

-- Metadata-only actual storage catalog rehearsal (no physical bytes, no API).
INSERT INTO storage.buckets(id,name,public) VALUES('feed-images','feed-images',false);
INSERT INTO storage.objects(id,bucket_id,name,owner,owner_id,version,metadata)
 VALUES('d2222222-2222-4222-8222-222222222222','feed-images','fixture/own-original.jpg','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','fixture-v1','{"size":4}'),
 ('d3333333-3333-4333-8333-333333333333','feed-images','fixture/other-original.jpg','22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','fixture-v2','{"size":4}');
UPDATE hoopcheck_export_private.media_policy SET enabled=true,max_objects=10,max_file_bytes=1024;
INSERT INTO hoopcheck_export_private.media_bucket_policy VALUES('feed-images',true);
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims='{"role":"service_role"}';
DO $media$ BEGIN
 IF public.prepare_account_export_media('d1111111-1111-4111-8111-111111111111') IS DISTINCT FROM '{"status":"prepared","discovered_count":1}'::jsonb THEN RAISE EXCEPTION 'Actual media inventory isolation failed'; END IF;
END $media$;
RESET ROLE;
UPDATE hoopcheck_export_private.media_items SET decision='approved',reviewed_at=now();
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims='{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2","session_id":"a1111111-1111-4111-8111-111111111111"}';
DO $manifest$ DECLARE m jsonb; BEGIN
 m:=public.account_export_media_manifest('d1111111-1111-4111-8111-111111111111');
 IF jsonb_array_length(m->'items')<>1 OR m->>'complete'<>'false' OR m::text LIKE '%fixture/own-original%' THEN RAISE EXCEPTION 'Actual manifest scope failed'; END IF;
END $manifest$;
RESET ROLE;

-- Seed a real request/lease and exact frozen step; synthetic receipts are used
-- only for earlier unrelated effects to exercise the actual database guards.
-- They are rolled back and are not evidence of actual provider effects.
SET LOCAL request.jwt.claims='{"role":"service_role"}';
INSERT INTO public.account_deletion_requests(id,user_id,status,scheduled_for) VALUES('d4444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','processing',now());
UPDATE hoopcheck_deletion_private.worker_config SET worker_enabled=true,policy_version='actual-fixture';
INSERT INTO hoopcheck_deletion_private.worker_state(request_id,policy_version,fence,lease_until,next_step)
 VALUES('d4444444-4444-4444-8444-444444444444','actual-fixture','d5555555-5555-4555-8555-555555555555',clock_timestamp()+interval '5 minutes',3);
INSERT INTO hoopcheck_deletion_private.worker_receipts(request_id,step_number,receipt)
 SELECT 'd4444444-4444-4444-8444-444444444444',i,'fixture_only' FROM generate_series(1,2) i;
SET LOCAL ROLE service_role;
DO $freeze$ BEGIN
 IF NOT public.freeze_approved_deletion_account('d4444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','d5555555-5555-4555-8555-555555555555')
 OR NOT public.checkpoint_account_deletion_worker('d4444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','d5555555-5555-4555-8555-555555555555','freeze_account_writes','fixture_freeze')
 THEN RAISE EXCEPTION 'Actual freeze/checkpoint failed'; END IF;
END $freeze$;
RESET ROLE;
UPDATE auth.users SET banned_until=now()+interval '30 days' WHERE id='11111111-1111-1111-1111-111111111111';
INSERT INTO auth.refresh_tokens(id,user_id,token,revoked,session_id) VALUES
 (910001,'11111111-1111-1111-1111-111111111111','fixture-own-token',false,'a1111111-1111-4111-8111-111111111111'),
 (910002,'11111111-1111-1111-1111-111111111111','fixture-own-legacy',false,NULL),
 (910003,'22222222-2222-2222-2222-222222222222','fixture-other-token',false,'b2222222-2222-4222-8222-222222222222');
UPDATE hoopcheck_deletion_private.auth_revocation_config SET enabled=true;
SET LOCAL ROLE service_role;
DO $revoke$ BEGIN
 IF NOT public.revoke_approved_deletion_auth_sessions('d4444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','d5555555-5555-4555-8555-555555555555')
 OR NOT public.verify_deletion_session_absence('d4444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','d5555555-5555-4555-8555-555555555555')
 THEN RAISE EXCEPTION 'Actual session revocation failed'; END IF;
END $revoke$;
RESET ROLE;
DO $session$ BEGIN
 IF EXISTS(SELECT FROM auth.sessions WHERE user_id='11111111-1111-1111-1111-111111111111')
 OR EXISTS(SELECT FROM auth.refresh_tokens WHERE user_id='11111111-1111-1111-1111-111111111111')
 OR NOT EXISTS(SELECT FROM auth.sessions WHERE id='b2222222-2222-4222-8222-222222222222')
 OR NOT EXISTS(SELECT FROM auth.refresh_tokens WHERE id=910003)
 THEN RAISE EXCEPTION 'Actual revocation scope incorrect'; END IF;
END $session$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims='{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2","session_id":"a1111111-1111-4111-8111-111111111111"}';
DO $frozen$ BEGIN
 BEGIN PERFORM public.account_export_job('download','d1111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'Frozen export accessible'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $frozen$;
RESET ROLE;
SET LOCAL request.jwt.claims='{"role":"service_role"}';

-- Fixture-only checkpoint prefix for step 8; actual provider operations are not called.
INSERT INTO hoopcheck_deletion_private.worker_receipts(request_id,step_number,receipt)
 SELECT 'd4444444-4444-4444-8444-444444444444',i,'fixture_only' FROM generate_series(4,7) i;
UPDATE hoopcheck_deletion_private.worker_state SET next_step=8 WHERE request_id='d4444444-4444-4444-8444-444444444444';
INSERT INTO hoopcheck_deletion_private.export_cleanup_approvals VALUES('d4444444-4444-4444-8444-444444444444','actual-fixture',true);
SET LOCAL ROLE service_role;
DO $scrub$ BEGIN
 IF public.scrub_approved_deletion_exports('d4444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','d5555555-5555-4555-8555-555555555555') IS DISTINCT FROM '{"ok":true,"removed_jobs":1}'::jsonb THEN RAISE EXCEPTION 'Actual export scrub failed'; END IF;
 IF public.scrub_approved_deletion_exports('d4444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','d5555555-5555-4555-8555-555555555555') IS DISTINCT FROM '{"ok":true,"removed_jobs":1}'::jsonb THEN RAISE EXCEPTION 'Actual export scrub retry failed'; END IF;
END $scrub$;
RESET ROLE;
DO $scrub_verify$ BEGIN
 IF EXISTS(SELECT FROM hoopcheck_export_private.jobs WHERE owner_id='11111111-1111-1111-1111-111111111111')
 OR EXISTS(SELECT FROM hoopcheck_export_private.media_items WHERE job_id='d1111111-1111-4111-8111-111111111111')
 OR EXISTS(SELECT FROM hoopcheck_export_private.records WHERE job_id='d1111111-1111-4111-8111-111111111111')
 OR NOT EXISTS(SELECT FROM storage.objects WHERE id='d2222222-2222-4222-8222-222222222222')
 THEN RAISE EXCEPTION 'Actual export scrub violated scope'; END IF;
END $scrub_verify$;

-- The original seeded A has pending records. Prove they block retention,
-- then approve only synthetic test records for the positive transition.
UPDATE hoopcheck_deletion_private.review_retention_config SET enabled=true;
SET LOCAL ROLE service_role;
DO $pending$ BEGIN
 BEGIN PERFORM public.retain_approved_deletion_reviews('d4444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','d5555555-5555-4555-8555-555555555555',false);
 RAISE EXCEPTION 'Pending review silently retained'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Review history requires separately approved disposition' THEN RAISE; END IF; END;
END $pending$;
RESET ROLE;
UPDATE public.reviews SET status='approved' WHERE author_id='11111111-1111-1111-1111-111111111111';
UPDATE public.womens_team_reviews SET status='approved' WHERE author_id='11111111-1111-1111-1111-111111111111';
DO $retain$ DECLARE d text; result jsonb; old_ids uuid[]; new_ids uuid[]; old_total bigint; old_sum numeric; new_sum numeric; BEGIN
 SELECT array_agg(id) INTO old_ids FROM (SELECT id FROM public.reviews WHERE author_id='11111111-1111-1111-1111-111111111111' UNION ALL SELECT id FROM public.womens_team_reviews WHERE author_id='11111111-1111-1111-1111-111111111111') x;
 SELECT count(*),sum(overall_rating) INTO old_total,old_sum FROM (SELECT overall_rating FROM public.reviews UNION ALL SELECT overall_rating FROM public.womens_team_reviews) x;
 d:=public.retain_approved_deletion_reviews('d4444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','d5555555-5555-4555-8555-555555555555',false)->>'scope_digest';
 INSERT INTO hoopcheck_deletion_private.review_retention_approvals(request_id,policy_version,scope_digest,retention_until,legal_hold_cleared,historical_linkage_cleared)
 VALUES('d4444444-4444-4444-8444-444444444444','actual-fixture',d,current_date+30,true,true);
 result:=public.retain_approved_deletion_reviews('d4444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','d5555555-5555-4555-8555-555555555555',true);
 IF result IS DISTINCT FROM jsonb_build_object('ok',true,'retained_count',cardinality(old_ids)) THEN RAISE EXCEPTION 'Actual retention receipt mismatch'; END IF;
 IF public.retain_approved_deletion_reviews('d4444444-4444-4444-8444-444444444444','11111111-1111-1111-1111-111111111111','d5555555-5555-4555-8555-555555555555',true) IS DISTINCT FROM result THEN RAISE EXCEPTION 'Actual retention retry mismatch'; END IF;
 IF EXISTS(SELECT FROM public.reviews WHERE author_id='11111111-1111-1111-1111-111111111111' OR id=ANY(old_ids))
 OR EXISTS(SELECT FROM public.womens_team_reviews WHERE author_id='11111111-1111-1111-1111-111111111111' OR id=ANY(old_ids))
 OR (SELECT count(*) FROM public.reviews)+(SELECT count(*) FROM public.womens_team_reviews)<>old_total
 THEN RAISE EXCEPTION 'Actual retention identity or count mismatch'; END IF;
 SELECT sum(overall_rating) INTO new_sum FROM (SELECT overall_rating FROM public.reviews UNION ALL SELECT overall_rating FROM public.womens_team_reviews) x;
 IF old_sum IS DISTINCT FROM new_sum THEN RAISE EXCEPTION 'Actual retention rating changed'; END IF;
 SELECT array_agg(id) INTO new_ids FROM public.reviews WHERE author_id IS NULL;
 IF (SELECT count(*) FROM public.get_retained_review_trust_facts('men',new_ids) WHERE reviewer_verified)<>cardinality(new_ids) THEN RAISE EXCEPTION 'Actual men trust facts missing'; END IF;
 SELECT array_agg(id) INTO new_ids FROM public.womens_team_reviews WHERE author_id IS NULL;
 IF (SELECT count(*) FROM public.get_retained_review_trust_facts('women',new_ids) WHERE reviewer_verified)<>cardinality(new_ids) THEN RAISE EXCEPTION 'Actual women trust facts missing'; END IF;
END $retain$;
RESET request.jwt.claims;
SELECT 'PASS: actual-schema privacy extensions and fenced effects';
