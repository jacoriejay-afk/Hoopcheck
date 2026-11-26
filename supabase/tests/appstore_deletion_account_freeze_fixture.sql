\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA realtime;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOLOGIN;
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);
CREATE TABLE auth.users(id uuid PRIMARY KEY,banned_until timestamptz,role text NOT NULL DEFAULT 'authenticated');
ALTER TABLE auth.users ADD COLUMN email text, ADD COLUMN email_confirmed_at timestamptz;
CREATE TABLE auth.identities(user_id uuid,provider text,provider_id text);
INSERT INTO auth.users(id,banned_until) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null);
CREATE TABLE auth.mfa_factors(user_id uuid,status text);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(auth.jwt()->>'sub','')::uuid $$;
GRANT USAGE ON SCHEMA auth,storage,realtime TO authenticated;
GRANT USAGE ON SCHEMA auth TO anon,service_role;
CREATE TABLE public.admin_roles(user_id uuid,role text);
GRANT SELECT ON public.admin_roles TO authenticated;
CREATE TABLE public.fixture_posts(id uuid PRIMARY KEY,owner_id uuid);
CREATE TABLE storage.objects(id uuid PRIMARY KEY,owner_id uuid);
CREATE TABLE realtime.messages(id uuid PRIMARY KEY,owner_id uuid);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['public.fixture_posts','storage.objects','realtime.messages'] LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %s TO authenticated',t);
  EXECUTE format('CREATE POLICY own_rows ON %s FOR ALL TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid())',t);
  EXECUTE format('INSERT INTO %s VALUES (''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''),(''22222222-2222-4222-8222-222222222222'',''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'')',t);
 END LOOP;
END $$;
\i supabase/migrations/20261106190000_add_account_deletion_requests.sql
\i supabase/migrations/20261118162456_opted_in_mfa_enforcement.sql
CREATE SCHEMA hoopcheck_deletion_private;
\i supabase/candidates/appstore_deletion_worker_state.sql
\i supabase/candidates/appstore_deletion_account_freeze.sql
\i supabase/candidates/appstore_apple_authorization_vault.sql
\i supabase/candidates/appstore_deletion_apple_vault_freeze.sql
INSERT INTO public.account_deletion_requests(id,user_id,scheduled_for,status) VALUES('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),'processing');
INSERT INTO hoopcheck_deletion_private.worker_state(request_id,policy_version,fence,lease_until,next_step) VALUES('33333333-3333-4333-8333-333333333333','fixture','44444444-4444-4444-8444-444444444444',now()+interval '5 minutes',3);
INSERT INTO hoopcheck_deletion_private.worker_receipts(request_id,step_number,receipt) SELECT '33333333-3333-4333-8333-333333333333',i,'fixture-'||i FROM generate_series(1,2)i;
INSERT INTO auth.sessions(id,user_id) VALUES('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('77777777-7777-4777-8777-777777777777','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
DO $$ BEGIN
 IF has_table_privilege('authenticated','hoopcheck_deletion_private.frozen_accounts','SELECT')
 OR has_table_privilege('service_role','hoopcheck_deletion_private.frozen_accounts','INSERT')
 OR has_function_privilege('authenticated','public.freeze_approved_deletion_account(uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Freeze ACL leak'; END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF public.freeze_approved_deletion_account('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Disabled worker froze account'; END IF;
END $$;
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=now();
INSERT INTO auth.identities VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apple','apple-a'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apple','apple-extra'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','apple','apple-b');
SET LOCAL ROLE service_role;
DO $ BEGIN
 IF NOT public.store_verified_apple_authorization('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555','apple-a','v1.originalIV.originalTag.originalCiphertext') THEN
  RAISE EXCEPTION 'Original authorization rejected';
 END IF;
END $;
RESET ROLE;
UPDATE hoopcheck_deletion_private.worker_config SET worker_enabled=true,policy_version='fixture';
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF public.freeze_approved_deletion_account('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Foreign owner accepted'; END IF;
 IF NOT public.freeze_approved_deletion_account('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Approved freeze denied'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $ BEGIN
 BEGIN
  PERFORM public.store_verified_apple_authorization('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555','apple-a','v1.fixtureIV.fixtureTag.fixtureCiphertext');
  RAISE EXCEPTION 'Frozen owner vault update allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.store_verified_apple_authorization('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555','apple-extra','v1.fixtureIV.fixtureTag.fixtureCiphertext');
  RAISE EXCEPTION 'Frozen owner vault insert allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF NOT public.store_verified_apple_authorization('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','77777777-7777-4777-8777-777777777777','apple-b','v1.fixtureIV.fixtureTag.fixtureCiphertext') THEN
  RAISE EXCEPTION 'Unfrozen owner vault write denied';
 END IF;
END $;
RESET ROLE;
DO $ BEGIN
 IF NOT EXISTS(SELECT 1 FROM hoopcheck_apple_private.authorization_vault WHERE owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND apple_subject='apple-a' AND encrypted_refresh_token='v1.originalIV.originalTag.originalCiphertext')
 OR (SELECT count(*) FROM hoopcheck_apple_private.authorization_vault)<>2 THEN RAISE EXCEPTION 'Vault owner isolation failed'; END IF;
END $;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","aal":"aal1","session_id":"55555555-5555-4555-8555-555555555555"}',true);
DO $$ DECLARE t text;n integer;BEGIN
 IF public.confirm_active_account_session() THEN RAISE EXCEPTION 'Frozen live session accepted'; END IF;
 FOREACH t IN ARRAY ARRAY['public.fixture_posts','storage.objects','realtime.messages'] LOOP
  EXECUTE format('SELECT count(*) FROM %s',t) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'Frozen account read allowed: %',t; END IF;
  BEGIN EXECUTE format('INSERT INTO %s VALUES (''66666666-6666-4666-8666-666666666666'',auth.uid())',t); RAISE EXCEPTION 'Frozen write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE format('DELETE FROM %s',t);GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Frozen delete allowed'; END IF;
 END LOOP;
 BEGIN PERFORM hoopcheck_security.require_mfa_and_deletion_access();RAISE EXCEPTION 'Frozen RPC allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","aal":"aal1","session_id":"77777777-7777-4777-8777-777777777777"}',true);
DO $$ BEGIN
 PERFORM hoopcheck_security.require_mfa_and_deletion_access();
 IF NOT public.confirm_active_account_session() THEN RAISE EXCEPTION 'Ordinary active session rejected'; END IF;
 IF (SELECT count(*) FROM public.fixture_posts)<>1 OR (SELECT count(*) FROM storage.objects)<>1 OR (SELECT count(*) FROM realtime.messages)<>1 THEN RAISE EXCEPTION 'Other account access regressed';END IF;
END $$;
RESET ROLE;
INSERT INTO hoopcheck_deletion_private.worker_receipts(request_id,step_number,receipt) VALUES('33333333-3333-4333-8333-333333333333',3,'fixture-3');
UPDATE hoopcheck_deletion_private.worker_state SET next_step=4;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF NOT public.assert_deletion_frozen_session_step('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Valid session step not verified'; END IF;
 IF public.assert_deletion_frozen_session_step('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Foreign session step accepted'; END IF;
 IF public.verify_deletion_auth_login_block('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Unbanned user accepted'; END IF;
 IF public.verify_deletion_session_absence('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Active session falsely cleared'; END IF;
END $$;
RESET ROLE;
-- Fixture simulates acknowledged Auth sign-out; no real sessions are modified.
DELETE FROM auth.sessions WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE auth.users SET banned_until=now()+interval '365 days' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF NOT public.verify_deletion_auth_login_block('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Auth ban not verified'; END IF;
 IF NOT public.verify_deletion_session_absence('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Session absence not verified'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","session_id":"55555555-5555-4555-8555-555555555555","aal":"aal1"}',true);
DO $$ BEGIN IF public.confirm_active_account_session() THEN RAISE EXCEPTION 'Foreign or revoked session accepted'; END IF; END $$;
RESET ROLE;
UPDATE auth.sessions SET not_after=now()-interval '1 day' WHERE user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","session_id":"77777777-7777-4777-8777-777777777777","aal":"aal1"}',true);
DO $$ BEGIN IF public.confirm_active_account_session() THEN RAISE EXCEPTION 'Expired session accepted'; END IF; END $$;
RESET ROLE;

-- Private preferences are a deliberately limited sub-operation, not a full
-- step-8 acknowledgment. Preserve another user's rows and unrelated content.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['fan_feed_archives','fan_live_game_reminders','feed_post_archives','feed_post_bookmarks','user_preferences','user_watchlists'] LOOP
  EXECUTE format('CREATE TABLE public.%I(user_id uuid NOT NULL, marker text)',t);
  EXECUTE format('INSERT INTO public.%I VALUES (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''target''),(''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'',''other'')',t);
 END LOOP;
END $$;
\i supabase/candidates/appstore_deletion_private_preferences_cleanup.sql
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.erase_approved_deletion_preferences(uuid,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Client cleanup allowed'; END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF public.erase_approved_deletion_preferences('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Out-of-order cleanup accepted'; END IF;
END $$;
RESET ROLE;
INSERT INTO hoopcheck_deletion_private.worker_receipts(request_id,step_number,receipt)
 SELECT '33333333-3333-4333-8333-333333333333',i,'fixture-'||i FROM generate_series(4,7)i;
UPDATE hoopcheck_deletion_private.worker_state SET next_step=8;
-- Add a dependency to the last table. No earlier rows may be erased.
ALTER TABLE public.user_watchlists ADD UNIQUE(user_id);
CREATE TABLE public.fixture_watchlist_dependency(user_id uuid REFERENCES public.user_watchlists(user_id));
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM public.erase_approved_deletion_preferences('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444');
  RAISE EXCEPTION 'Schema drift unexpectedly accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Preference cleanup scope drift' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM public.fan_feed_archives)<>2 THEN RAISE EXCEPTION 'Partial deletion on schema drift'; END IF; END $$;
DROP TABLE public.fixture_watchlist_dependency;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF public.erase_approved_deletion_preferences('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Foreign owner accepted'; END IF;
 IF NOT public.erase_approved_deletion_preferences('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444')
 OR NOT public.erase_approved_deletion_preferences('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Private cleanup or idempotent retry failed'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE t text;n integer; BEGIN
 FOREACH t IN ARRAY ARRAY['fan_feed_archives','fan_live_game_reminders','feed_post_archives','feed_post_bookmarks','user_preferences','user_watchlists'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE marker=''other''',t) INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'Other account row lost'; END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE marker=''target''',t) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'Target row retained'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM hoopcheck_deletion_private.worker_receipts WHERE step_number=8) THEN RAISE EXCEPTION 'Partial cleanup falsely marked complete'; END IF;
END $$;


-- Separate synthetic deletion request for completion contact lifecycle.

UPDATE auth.users SET email='fixture@example.com',email_confirmed_at=now() WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
\i supabase/candidates/appstore_deletion_completion_delivery.sql
INSERT INTO public.account_deletion_requests(id,user_id,scheduled_for,status) VALUES('88888888-8888-4888-8888-888888888888','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now(),'processing');
INSERT INTO hoopcheck_deletion_private.worker_state(request_id,policy_version,fence,lease_until,next_step) VALUES('88888888-8888-4888-8888-888888888888','fixture','99999999-9999-4999-8999-999999999999',now()+interval '5 minutes',2);
INSERT INTO hoopcheck_deletion_private.worker_receipts(request_id,step_number,receipt) VALUES('88888888-8888-4888-8888-888888888888',1,'fixture-scope');
DO $$ BEGIN
 IF has_table_privilege('service_role','hoopcheck_deletion_private.completion_delivery','SELECT') OR has_function_privilege('authenticated','public.account_deletion_completion_action(uuid,uuid,uuid,text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Contact access exposed'; END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$ DECLARE rid uuid:='88888888-8888-4888-8888-888888888888';own uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';f uuid:='99999999-9999-4999-8999-999999999999';BEGIN
 IF (public.account_deletion_completion_action(rid,own,f,'capture','v1.fixtureIV.fixtureTag.fixtureCiphertext')->>'ok') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Capture failed'; END IF;
 BEGIN PERFORM public.account_deletion_completion_action(rid,own,f,'begin'); RAISE EXCEPTION 'Early send allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.account_deletion_completion_action(rid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',f,'capture_read'); RAISE EXCEPTION 'Foreign contact exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO hoopcheck_deletion_private.worker_receipts(request_id,step_number,receipt) SELECT '88888888-8888-4888-8888-888888888888',i,'fixture-'||i FROM generate_series(2,10)i;
UPDATE hoopcheck_deletion_private.worker_state SET next_step=11 WHERE request_id='88888888-8888-4888-8888-888888888888';
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN PERFORM public.account_deletion_completion_action('88888888-8888-4888-8888-888888888888','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','99999999-9999-4999-8999-999999999999','begin');
 RAISE EXCEPTION 'Unexpected early send' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Auth identity remains' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DELETE FROM auth.users WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET LOCAL ROLE service_role;
DO $$ DECLARE rid uuid:='88888888-8888-4888-8888-888888888888';own uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';f uuid:='99999999-9999-4999-8999-999999999999';pid uuid:='77777777-7777-4777-8777-777777777777';BEGIN
 IF public.account_deletion_completion_action(rid,own,f,'begin')->>'first_attempt_at' IS NULL THEN RAISE EXCEPTION 'Attempt not persisted'; END IF;
 IF (public.account_deletion_completion_action(rid,own,f,'accepted',NULL,pid)->>'delivered') IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Acceptance falsely counted as delivery'; END IF;
 IF (public.account_deletion_completion_action(rid,own,f,'delivered',NULL,pid)->>'delivered') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Delivery not recorded'; END IF;
END $$;
RESET ROLE;
INSERT INTO hoopcheck_deletion_private.worker_receipts(request_id,step_number,receipt) VALUES('88888888-8888-4888-8888-888888888888',11,'fixture-delivery');
UPDATE hoopcheck_deletion_private.worker_state SET next_step=12 WHERE request_id='88888888-8888-4888-8888-888888888888';
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF (public.account_deletion_completion_action('88888888-8888-4888-8888-888888888888','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','99999999-9999-4999-8999-999999999999','scrub')->>'ok') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Contact scrub failed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM hoopcheck_deletion_private.completion_delivery WHERE envelope IS NOT NULL OR provider_id IS NOT NULL OR scrubbed_at IS NULL) THEN RAISE EXCEPTION 'Contact material retained'; END IF;
END $$;


-- Review thread fixture. Evidence and third-party content never cascade
-- merely because an account is frozen. A reviewed ID-set digest is required.
CREATE TABLE public.reviews(id uuid PRIMARY KEY,author_id uuid NOT NULL);
CREATE TABLE public.womens_team_reviews(id uuid PRIMARY KEY,author_id uuid NOT NULL);
CREATE TABLE public.review_comments(id uuid PRIMARY KEY,author_id uuid NOT NULL,review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE);
CREATE TABLE public.review_likes(id uuid PRIMARY KEY,user_id uuid NOT NULL,review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE);
CREATE TABLE public.review_reports(id uuid PRIMARY KEY,reporter_id uuid NOT NULL,review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE);
CREATE TABLE public.review_moderation_events(id uuid PRIMARY KEY,actor_id uuid,review_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE,report_id uuid REFERENCES public.review_reports(id) ON DELETE CASCADE);
\i supabase/candidates/appstore_deletion_review_cleanup.sql
INSERT INTO public.reviews VALUES('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('10000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.womens_team_reviews VALUES('20000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.review_comments VALUES('30000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','10000000-0000-4000-8000-000000000001'),('30000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000002');
INSERT INTO public.review_reports VALUES('40000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','10000000-0000-4000-8000-000000000001');
SET LOCAL ROLE service_role;
DO $$ DECLARE r uuid:='33333333-3333-4333-8333-333333333333';o uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';f uuid:='44444444-4444-4444-8444-444444444444';scope jsonb;BEGIN
 scope:=public.approved_deletion_review_scope(r,o,f,false);
 IF scope->>'reports'<>'1' OR scope->>'third_party'<>'1' THEN RAISE EXCEPTION 'Review scope incomplete'; END IF;
 BEGIN PERFORM public.approved_deletion_review_scope(r,o,f,true);RAISE EXCEPTION 'Evidence removed' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Review evidence requires retention disposition' THEN RAISE; END IF;END;
END $$;
RESET ROLE;
-- Fixture-only disposition of synthetic report, not a production policy.
DELETE FROM public.review_reports;
INSERT INTO hoopcheck_deletion_private.review_cleanup_approvals(request_id,policy_version,scope_digest,allow_thread_removal)
 SELECT '33333333-3333-4333-8333-333333333333',w.policy_version,public.approved_deletion_review_scope('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444',false)->>'scope_digest',false
 FROM hoopcheck_deletion_private.worker_state w WHERE w.request_id='33333333-3333-4333-8333-333333333333';
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN PERFORM public.approved_deletion_review_scope('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444',true);RAISE EXCEPTION 'Unapproved thread erased' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Exact review scope approval required' THEN RAISE; END IF;END;
END $$;
RESET ROLE;
UPDATE hoopcheck_deletion_private.review_cleanup_approvals SET allow_thread_removal=true;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF public.approved_deletion_review_scope('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444',true)->>'ok' IS DISTINCT FROM 'true'
 OR public.approved_deletion_review_scope('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444',true)->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Review cleanup or retry failed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.reviews)<>1 OR NOT EXISTS(SELECT 1 FROM public.reviews WHERE author_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
 OR EXISTS(SELECT 1 FROM public.womens_team_reviews) OR EXISTS(SELECT 1 FROM public.review_comments) THEN RAISE EXCEPTION 'Review cleanup scope mismatch'; END IF;
END $$;

ROLLBACK;
\echo PASS: freeze gate, owner isolation, direct writes and reads, RPC gate, session absence
