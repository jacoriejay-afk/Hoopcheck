\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA realtime;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOLOGIN;
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid);
CREATE TABLE auth.users(id uuid PRIMARY KEY,banned_until timestamptz);
INSERT INTO auth.users VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null);
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
INSERT INTO public.account_deletion_requests(id,user_id,scheduled_for,status) VALUES('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),'processing');
INSERT INTO hoopcheck_deletion_private.worker_state(request_id,policy_version,fence,lease_until,next_step) VALUES('33333333-3333-4333-8333-333333333333','fixture','44444444-4444-4444-8444-444444444444',now()+interval '5 minutes',3);
INSERT INTO hoopcheck_deletion_private.worker_receipts(request_id,step_number,receipt) SELECT '33333333-3333-4333-8333-333333333333',i,'fixture-'||i FROM generate_series(1,2)i;
INSERT INTO auth.sessions VALUES('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
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
UPDATE hoopcheck_deletion_private.worker_config SET worker_enabled=true,policy_version='fixture';
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF public.freeze_approved_deletion_account('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Foreign owner accepted'; END IF;
 IF NOT public.freeze_approved_deletion_account('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Approved freeze denied'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","aal":"aal1"}',true);
DO $$ DECLARE t text;n integer;BEGIN
 FOREACH t IN ARRAY ARRAY['public.fixture_posts','storage.objects','realtime.messages'] LOOP
  EXECUTE format('SELECT count(*) FROM %s',t) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'Frozen account read allowed: %',t; END IF;
  BEGIN EXECUTE format('INSERT INTO %s VALUES (''66666666-6666-4666-8666-666666666666'',auth.uid())',t); RAISE EXCEPTION 'Frozen write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE format('DELETE FROM %s',t);GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Frozen delete allowed'; END IF;
 END LOOP;
 BEGIN PERFORM hoopcheck_security.require_mfa_and_deletion_access();RAISE EXCEPTION 'Frozen RPC allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","aal":"aal1"}',true);
DO $$ BEGIN
 PERFORM hoopcheck_security.require_mfa_and_deletion_access();
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
DELETE FROM auth.sessions;
UPDATE auth.users SET banned_until=now()+interval '365 days' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF NOT public.verify_deletion_auth_login_block('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Auth ban not verified'; END IF;
 IF NOT public.verify_deletion_session_absence('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Session absence not verified'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
\echo PASS: freeze gate, owner isolation, direct writes and reads, RPC gate, session absence
