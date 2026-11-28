-- Synthetic only. Run in a fresh disposable PG17 database.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA hoopcheck_deletion_private;
GRANT USAGE ON SCHEMA hoopcheck_deletion_private TO service_role;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL);
CREATE TABLE auth.refresh_tokens(id bigint PRIMARY KEY,user_id varchar(255),session_id uuid REFERENCES auth.sessions(id) ON DELETE CASCADE,revoked boolean);
CREATE TABLE auth.mfa_amr_claims(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE);
CREATE TABLE public.account_deletion_requests(id uuid PRIMARY KEY,user_id uuid NOT NULL);
CREATE TABLE hoopcheck_deletion_private.worker_state(request_id uuid PRIMARY KEY,fence uuid,next_step integer);
CREATE TABLE hoopcheck_deletion_private.frozen_accounts(owner_id uuid PRIMARY KEY,request_id uuid);
CREATE TABLE auth.users(id uuid PRIMARY KEY,banned_until timestamptz);
CREATE FUNCTION public.assert_deletion_frozen_session_step(p_request uuid,p_owner uuid,p_fence uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT FROM public.account_deletion_requests r JOIN hoopcheck_deletion_private.worker_state w ON w.request_id=r.id JOIN hoopcheck_deletion_private.frozen_accounts f ON f.request_id=r.id AND f.owner_id=r.user_id
 WHERE r.id=p_request AND r.user_id=p_owner AND w.fence=p_fence AND w.next_step=4)
$$;
CREATE FUNCTION public.verify_deletion_auth_login_block(p_request uuid,p_owner uuid,p_fence uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.assert_deletion_frozen_session_step(p_request,p_owner,p_fence) AND EXISTS(SELECT 1 FROM auth.users WHERE id=p_owner AND banned_until>now())
$$;
INSERT INTO public.account_deletion_requests VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
INSERT INTO hoopcheck_deletion_private.worker_state VALUES('33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444',4);
INSERT INTO hoopcheck_deletion_private.frozen_accounts VALUES('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333');
INSERT INTO auth.users VALUES('11111111-1111-4111-8111-111111111111',now()+interval '1 day'),('22222222-2222-4222-8222-222222222222',NULL);
INSERT INTO auth.sessions VALUES('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111'),('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222');
INSERT INTO auth.refresh_tokens VALUES(1,'11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',false),(2,'11111111-1111-4111-8111-111111111111',NULL,false),(3,'22222222-2222-4222-8222-222222222222','66666666-6666-4666-8666-666666666666',false),(4,'22222222-2222-4222-8222-222222222222',NULL,false);
INSERT INTO auth.mfa_amr_claims(session_id) VALUES('55555555-5555-4555-8555-555555555555'),('66666666-6666-4666-8666-666666666666');
\ir ../candidates/appstore_deletion_auth_session_revocation_review_only.sql
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',false);
DO $$BEGIN
 BEGIN PERFORM public.revoke_approved_deletion_auth_sessions('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444'); RAISE EXCEPTION 'caller effect accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
DO $$BEGIN
 BEGIN PERFORM public.revoke_approved_deletion_auth_sessions('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444'); RAISE EXCEPTION 'disabled effect accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
UPDATE hoopcheck_deletion_private.auth_revocation_config SET enabled=true;
SET ROLE service_role;
DO $$BEGIN
 BEGIN PERFORM public.revoke_approved_deletion_auth_sessions('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444'); RAISE EXCEPTION 'foreign owner accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.revoke_approved_deletion_auth_sessions('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666'); RAISE EXCEPTION 'stale lease accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
INSERT INTO auth.refresh_tokens VALUES(5,'22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555',false);
SET ROLE service_role;
DO $$BEGIN
 BEGIN PERFORM public.revoke_approved_deletion_auth_sessions('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444'); RAISE EXCEPTION 'foreign token erased'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Auth token ownership mismatch' THEN RAISE; END IF; END;
END$$;
RESET ROLE;
DO $$BEGIN IF (SELECT count(*) FROM auth.refresh_tokens)<>5 OR (SELECT count(*) FROM auth.sessions)<>2 THEN RAISE EXCEPTION 'partial effect escaped'; END IF; END$$;
DELETE FROM auth.refresh_tokens WHERE id=5;
UPDATE auth.users SET banned_until=NULL WHERE id='11111111-1111-4111-8111-111111111111';
SET ROLE service_role;
DO $$BEGIN
 BEGIN PERFORM public.revoke_approved_deletion_auth_sessions('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444'); RAISE EXCEPTION 'unbanned account accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='11111111-1111-4111-8111-111111111111';
SET ROLE service_role;
DO $$BEGIN
 IF NOT public.revoke_approved_deletion_auth_sessions('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444') OR NOT public.revoke_approved_deletion_auth_sessions('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444')
 OR NOT hoopcheck_deletion_private.verify_frozen_session_absence('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'revocation or retry failed'; END IF;
END$$;
RESET ROLE;
DO $$BEGIN
 IF EXISTS(SELECT FROM auth.sessions WHERE user_id='11111111-1111-4111-8111-111111111111') OR EXISTS(SELECT FROM auth.refresh_tokens WHERE user_id='11111111-1111-4111-8111-111111111111')
 OR EXISTS(SELECT FROM auth.mfa_amr_claims WHERE session_id='55555555-5555-4555-8555-555555555555')
 OR (SELECT count(*) FROM auth.sessions WHERE user_id='22222222-2222-4222-8222-222222222222')<>1 OR (SELECT count(*) FROM auth.refresh_tokens WHERE user_id='22222222-2222-4222-8222-222222222222')<>2
 OR (SELECT count(*) FROM auth.mfa_amr_claims WHERE session_id='66666666-6666-4666-8666-666666666666')<>1 THEN RAISE EXCEPTION 'revocation scope mismatch'; END IF;
END$$;
INSERT INTO auth.refresh_tokens VALUES(6,'11111111-1111-4111-8111-111111111111',NULL,false);
DO $$BEGIN IF hoopcheck_deletion_private.verify_frozen_session_absence('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'legacy refresh token omitted from proof'; END IF; END$$;
\echo PASS: disabled, fenced, owner-scoped session and legacy refresh-token revocation, drift failure and idempotent retry
