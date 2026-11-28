-- REVIEW ONLY. Version-specific Auth catalog candidate, not a supported
-- general-purpose Auth administration API. Install only after freeze/worker
-- state and only on an independently restored disposable PG17 database.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='25s';
CREATE TABLE hoopcheck_deletion_private.auth_revocation_config(
 singleton boolean PRIMARY KEY CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false
);
INSERT INTO hoopcheck_deletion_private.auth_revocation_config VALUES(true,false);
ALTER TABLE hoopcheck_deletion_private.auth_revocation_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_deletion_private.auth_revocation_config FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION hoopcheck_deletion_private.revoke_frozen_auth_sessions(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text,17001));
 -- Preserve lock ordering with the deletion state machine. Never use arbitrary
 -- user-supplied owner ids; the exact worker lease and current ban are required.
 PERFORM 1 FROM hoopcheck_deletion_private.worker_state w JOIN public.account_deletion_requests r ON r.id=w.request_id
 WHERE w.request_id=p_request AND r.user_id=p_owner AND w.fence=p_fence AND w.next_step=4 FOR UPDATE OF r,w;
 IF NOT FOUND OR NOT coalesce(public.assert_deletion_frozen_session_step(p_request,p_owner,p_fence),false)
 OR NOT coalesce(public.verify_deletion_auth_login_block(p_request,p_owner,p_fence),false)
 THEN RAISE EXCEPTION 'Frozen worker required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM hoopcheck_deletion_private.auth_revocation_config WHERE singleton AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Auth revocation disabled' USING ERRCODE='42501'; END IF;
 -- Reconcile against the reviewed auth.sessions / refresh_tokens / AMR FK
 -- catalog. Lock against concurrent auth writes and abort on unknown cascade
 -- dependencies; never operate on provider-managed tables on schema drift.
 LOCK TABLE auth.sessions,auth.refresh_tokens,auth.mfa_amr_claims IN SHARE ROW EXCLUSIVE MODE;
 IF (SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='auth.sessions'::regclass)<>2
 OR (SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='auth.sessions'::regclass AND confdeltype='c' AND
 (conrelid,conname) IN (('auth.refresh_tokens'::regclass,'refresh_tokens_session_id_fkey'),
 ('auth.mfa_amr_claims'::regclass,'mfa_amr_claims_session_id_fkey')))<>2
 OR EXISTS(SELECT 1 FROM pg_constraint WHERE contype='f' AND confrelid IN ('auth.refresh_tokens'::regclass,'auth.mfa_amr_claims'::regclass))
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('auth.sessions'::regclass,'auth.refresh_tokens'::regclass,'auth.mfa_amr_claims'::regclass))
 OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid IN ('auth.sessions'::regclass,'auth.refresh_tokens'::regclass,'auth.mfa_amr_claims'::regclass) OR inhparent IN ('auth.sessions'::regclass,'auth.refresh_tokens'::regclass,'auth.mfa_amr_claims'::regclass))
 THEN RAISE EXCEPTION 'Auth revocation catalog drift'; END IF;
 -- Cross-owner token/session links are a hard failure, not a reason to erase
 -- another account. Legacy tokens with no session are explicitly included.
 IF EXISTS(SELECT 1 FROM auth.refresh_tokens t JOIN auth.sessions s ON s.id=t.session_id
   WHERE (s.user_id=p_owner OR t.user_id=p_owner::text) AND t.user_id IS DISTINCT FROM s.user_id::text)
 THEN RAISE EXCEPTION 'Auth token ownership mismatch'; END IF;
 IF NOT coalesce(public.assert_deletion_frozen_session_step(p_request,p_owner,p_fence),false)
 OR NOT coalesce(public.verify_deletion_auth_login_block(p_request,p_owner,p_fence),false)
 THEN RAISE EXCEPTION 'Frozen worker required' USING ERRCODE='42501'; END IF;
 DELETE FROM auth.sessions WHERE user_id=p_owner;
 -- Existing session-scoped tokens and AMR claims cascade; remove any owner
 -- legacy token rows too. No token value is returned or logged.
 DELETE FROM auth.refresh_tokens WHERE user_id=p_owner::text;
 IF EXISTS(SELECT 1 FROM auth.sessions WHERE user_id=p_owner)
 OR EXISTS(SELECT 1 FROM auth.refresh_tokens WHERE user_id=p_owner::text)
 OR NOT coalesce(public.assert_deletion_frozen_session_step(p_request,p_owner,p_fence),false)
 OR NOT coalesce(public.verify_deletion_auth_login_block(p_request,p_owner,p_fence),false)
 THEN RAISE EXCEPTION 'Auth revocation not confirmed'; END IF;
 RETURN true;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.revoke_frozen_auth_sessions(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.revoke_frozen_auth_sessions(uuid,uuid,uuid) TO service_role;
CREATE FUNCTION public.revoke_approved_deletion_auth_sessions(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT hoopcheck_deletion_private.revoke_frozen_auth_sessions(p_request,p_owner,p_fence)
$f$;
REVOKE ALL ON FUNCTION public.revoke_approved_deletion_auth_sessions(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.revoke_approved_deletion_auth_sessions(uuid,uuid,uuid) TO service_role;

-- Keep the existing confirmation API, but extend proof to legacy refresh
-- tokens as well as sessions. A banned account alone is not a revocation.
CREATE OR REPLACE FUNCTION hoopcheck_deletion_private.verify_frozen_session_absence(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text,17001));
 RETURN coalesce(public.assert_deletion_frozen_session_step(p_request,p_owner,p_fence),false)
 AND NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=p_owner)
 AND NOT EXISTS(SELECT 1 FROM auth.refresh_tokens t WHERE t.user_id=p_owner::text);
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.verify_frozen_session_absence(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.verify_frozen_session_absence(uuid,uuid,uuid) TO service_role;
COMMIT;
