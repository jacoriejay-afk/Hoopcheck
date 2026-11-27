-- Invoked inside the StoreKit synthetic fixture transaction, after its normal
-- assertions. This is a cross-component test, NOT production-schema acceptance.
ALTER TABLE auth.users ADD COLUMN role text NOT NULL DEFAULT 'authenticated',
 ADD COLUMN email text, ADD COLUMN email_confirmed_at timestamptz,
 ADD COLUMN banned_until timestamptz;
UPDATE auth.users SET email=id::text||'@example.test',email_confirmed_at=now();
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz);
CREATE TABLE auth.identities(user_id uuid,provider text,provider_id text);
CREATE TABLE public.admin_roles(user_id uuid,role text);
GRANT SELECT ON public.admin_roles TO authenticated;
INSERT INTO auth.sessions VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',NULL),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',NULL);
INSERT INTO auth.identities VALUES
 ('11111111-1111-4111-8111-111111111111','apple','fixture-owner-one'),
 ('22222222-2222-4222-8222-222222222222','apple','fixture-owner-two');
\ir ../migrations/20261106190000_add_account_deletion_requests.sql
\ir ../candidates/appstore_apple_authorization_vault.sql
\ir ../candidates/appstore_deletion_request_only.sql
\ir ../candidates/appstore_deletion_worker_state.sql
\ir ../candidates/appstore_deletion_account_freeze.sql
\ir ../candidates/appstore_deletion_apple_revocations.sql
\ir ../candidates/appstore_deletion_completion_delivery.sql
-- Fixture-only test activation; no hosted settings are touched.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM hoopcheck_deletion_private.config WHERE request_enabled)
 OR EXISTS(SELECT 1 FROM hoopcheck_deletion_private.worker_config WHERE worker_enabled)
 THEN RAISE EXCEPTION 'Deletion enabled by default'; END IF;
END $$;
UPDATE hoopcheck_deletion_private.config SET request_enabled=true;
UPDATE hoopcheck_deletion_private.worker_config SET worker_enabled=true,policy_version='combined-fixture';
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$ BEGIN
 IF NOT public.store_verified_apple_authorization('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fixture-owner-one','v1.fixtureIV.fixtureTag.fixtureCiphertext')
 THEN RAISE EXCEPTION 'Active Apple session rejected'; END IF;
END $$;
RESET ROLE;
SELECT set_config('fixture.combined.claims',jsonb_build_object('role','authenticated','sub','11111111-1111-4111-8111-111111111111','aal','aal2','session_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','exp',extract(epoch FROM now())::bigint+600,'amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',extract(epoch FROM now())::bigint)))::text,true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',current_setting('fixture.combined.claims'),true);
DO $$ DECLARE req uuid; BEGIN
 PERFORM hoopcheck_security.require_mfa_and_deletion_access();
 IF NOT public.confirm_active_account_session() OR NOT EXISTS(SELECT 1 FROM public.membership_entitlements WHERE provider='stripe') THEN RAISE EXCEPTION 'Existing account access regressed before freeze'; END IF;
 SELECT request_id INTO req FROM public.record_verified_account_deletion_request('DELETE','as_soon_as_possible');
 IF req IS NULL THEN RAISE EXCEPTION 'Valid deletion request rejected'; END IF;
 PERFORM set_config('fixture.combined.request',req::text,true);
END $$;
RESET ROLE;
INSERT INTO hoopcheck_deletion_private.worker_state(request_id,policy_version)
 VALUES(current_setting('fixture.combined.request')::uuid,'combined-fixture');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$ DECLARE l record; BEGIN
 SELECT * INTO l FROM public.claim_account_deletion_worker();
 IF l.request_id IS DISTINCT FROM current_setting('fixture.combined.request')::uuid
 OR l.owner_id IS DISTINCT FROM '11111111-1111-4111-8111-111111111111'::uuid
 THEN RAISE EXCEPTION 'Wrong worker claim'; END IF;
 -- Scope/contact receipts are synthetic placeholders, not actual fulfillment.
 IF NOT public.checkpoint_account_deletion_worker(l.request_id,l.owner_id,l.fence,'approve_scope','synthetic-scope')
 OR NOT public.checkpoint_account_deletion_worker(l.request_id,l.owner_id,l.fence,'capture_completion_contact','synthetic-contact')
 OR NOT public.freeze_approved_deletion_account(l.request_id,l.owner_id,l.fence)
 THEN RAISE EXCEPTION 'Approved freeze failed'; END IF;
 BEGIN
  PERFORM public.store_verified_apple_authorization(l.owner_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fixture-owner-one','v1.replacementIV.replacementTag.replacementCiphertext');
  RAISE EXCEPTION 'Frozen account renewed Apple authorization';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF NOT public.store_verified_apple_authorization('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','fixture-owner-two','v1.fixtureIV.fixtureTag.fixtureCiphertext')
 THEN RAISE EXCEPTION 'Unrelated Apple authorization rejected'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',current_setting('fixture.combined.claims'),true);
DO $$ BEGIN
 IF public.confirm_active_account_session() OR EXISTS(SELECT 1 FROM public.membership_entitlements) THEN RAISE EXCEPTION 'Frozen account retained active entitlement or session'; END IF;
 BEGIN PERFORM hoopcheck_security.require_mfa_and_deletion_access();
  RAISE EXCEPTION 'Frozen account passed pre-request hook';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222","aal":"aal1","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
DO $$ BEGIN
 PERFORM hoopcheck_security.require_mfa_and_deletion_access();
 IF NOT public.confirm_active_account_session() THEN RAISE EXCEPTION 'Unrelated account frozen'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM hoopcheck_apple_private.authorization_vault WHERE owner_id='11111111-1111-4111-8111-111111111111' AND encrypted_refresh_token='v1.fixtureIV.fixtureTag.fixtureCiphertext')
 OR NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE user_id='11111111-1111-4111-8111-111111111111' AND stripe_subscription_id='sub_fixture')
 THEN RAISE EXCEPTION 'Freeze unexpectedly changed vault or financial record'; END IF;
END $$;
\echo PASS: combined StoreKit/MFA/deletion freeze/Apple vault boundaries (synthetic, transaction rolled back by parent)
