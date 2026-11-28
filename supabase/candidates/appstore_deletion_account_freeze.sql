-- REVIEW ONLY. Apply after the worker state and opted-in MFA candidates.
-- No account is frozen by installing this file. The worker remains disabled.
-- Protect direct authenticated Data API, Storage, Realtime and Data API RPCs.
-- Privileged service routes, existing realtime sockets, signed media URLs and
-- provider callbacks require separate acceptance; this is not a full freeze proof.
CREATE TABLE IF NOT EXISTS hoopcheck_deletion_private.frozen_accounts(
  owner_id uuid PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE REFERENCES public.account_deletion_requests(id) ON DELETE RESTRICT,
  frozen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE hoopcheck_deletion_private.frozen_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_deletion_private.frozen_accounts FROM public,anon,authenticated,service_role;

-- Check only the caller's own JWT identity; do not expose arbitrary account lookups.
CREATE OR REPLACE FUNCTION hoopcheck_deletion_private.caller_not_frozen()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM hoopcheck_deletion_private.frozen_accounts f WHERE f.owner_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.caller_not_frozen() FROM public,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA hoopcheck_deletion_private TO authenticated;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.caller_not_frozen() TO authenticated;

-- A caller-bound proof for privileged server endpoints before they use service
-- credentials. The caller's verified JWT, not a supplied UUID, selects the row.
-- This is deliberately a separate proof from getUser or JWT expiry.
CREATE OR REPLACE FUNCTION hoopcheck_deletion_private.active_caller_session()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(
  auth.uid() IS NOT NULL AND auth.jwt()->>'role'='authenticated'
  AND coalesce(auth.jwt()->>'is_anonymous','false')='false'
  AND NOT (auth.jwt() ? 'client_id')
  AND hoopcheck_deletion_private.caller_not_frozen()
  AND EXISTS(SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
    WHERE s.id::text=auth.jwt()->>'session_id' AND s.user_id=auth.uid()
      AND (s.not_after IS NULL OR s.not_after>now())
      AND u.role='authenticated' AND (u.banned_until IS NULL OR u.banned_until<=now())),
  false)
$$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.active_caller_session() FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.active_caller_session() TO authenticated;
CREATE OR REPLACE FUNCTION public.confirm_active_account_session()
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT hoopcheck_deletion_private.active_caller_session()
$$;
REVOKE ALL ON FUNCTION public.confirm_active_account_session() FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.confirm_active_account_session() TO authenticated;

-- Existing policies remain unchanged. Require the same live, unfrozen session
-- for rows served through PostgREST, Storage and Realtime.
-- Newly created tables must receive the same protection before rollout.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','p') AND c.relrowsecurity
  AND (n.nspname='public' OR (n.nspname='storage' AND c.relname='objects') OR (n.nspname='realtime' AND c.relname='messages'))
 LOOP
  EXECUTE format('DROP POLICY IF EXISTS hoopcheck_deletion_freeze ON %I.%I',t.nspname,t.relname);
  EXECUTE format('CREATE POLICY hoopcheck_deletion_freeze ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT hoopcheck_deletion_private.active_caller_session())) WITH CHECK ((SELECT hoopcheck_deletion_private.active_caller_session()))',t.nspname,t.relname);
 END LOOP;
END $$;

-- Compose with the existing reviewed MFA hook. Do not replace unrelated hooks.
DO $$ BEGIN
 IF to_regprocedure('hoopcheck_security.require_mfa()') IS NULL THEN
  RAISE EXCEPTION 'Install and verify opted-in MFA prerequisite first';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_db_role_setting s,LATERAL unnest(s.setconfig) setting
 WHERE s.setrole IN (0,(SELECT oid FROM pg_roles WHERE rolname='authenticator'))
 AND s.setdatabase IN (0,(SELECT oid FROM pg_database WHERE datname=current_database()))
 AND setting LIKE 'pgrst.db_pre_request=%'
 AND split_part(setting,'=',2) NOT IN ('','hoopcheck_security.require_mfa','hoopcheck_security.require_mfa_and_deletion_access'))
 THEN RAISE EXCEPTION 'Unexpected Data API hook; reconcile before rollout'; END IF;
END $$;
CREATE OR REPLACE FUNCTION hoopcheck_security.require_mfa_and_deletion_access()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM hoopcheck_security.require_mfa();
 IF auth.jwt()->>'role'='authenticated' THEN
  IF NOT hoopcheck_deletion_private.active_caller_session() THEN
   RAISE EXCEPTION 'Account session is unavailable' USING ERRCODE='42501';
  END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION hoopcheck_security.require_mfa_and_deletion_access() FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_security.require_mfa_and_deletion_access() TO anon,authenticated,service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request='hoopcheck_security.require_mfa_and_deletion_access';
NOTIFY pgrst,'reload config';

-- Only the worker holding the exact approved request and step may freeze.
-- No service role direct table access. Same owner advisory lock as the request
-- and Apple vault. Never automatically remove a freeze when a retry fails.
CREATE OR REPLACE FUNCTION hoopcheck_deletion_private.freeze_approved_account(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,17001));
 IF NOT public.assert_account_deletion_worker(p_request,p_owner,p_fence)
 OR NOT EXISTS(SELECT 1 FROM hoopcheck_deletion_private.worker_state w WHERE w.request_id=p_request AND w.next_step=3)
 OR (SELECT count(*) FROM hoopcheck_deletion_private.worker_receipts r WHERE r.request_id=p_request AND r.step_number IN (1,2))<>2
 THEN RETURN false; END IF;
 INSERT INTO hoopcheck_deletion_private.frozen_accounts(owner_id,request_id) VALUES(p_owner,p_request)
 ON CONFLICT(owner_id) DO NOTHING;
 RETURN EXISTS(SELECT 1 FROM hoopcheck_deletion_private.frozen_accounts f WHERE f.owner_id=p_owner AND f.request_id=p_request);
END $$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.freeze_approved_account(uuid,uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.freeze_approved_account(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.freeze_approved_deletion_account(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT hoopcheck_deletion_private.freeze_approved_account(p_request,p_owner,p_fence)
$$;
REVOKE ALL ON FUNCTION public.freeze_approved_deletion_account(uuid,uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.freeze_approved_deletion_account(uuid,uuid,uuid) TO service_role;

-- Narrow proof for the next worker step; no credential or Auth rows returned.
CREATE OR REPLACE FUNCTION hoopcheck_deletion_private.verify_frozen_session_absence(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,17001));
 RETURN public.assert_account_deletion_worker(p_request,p_owner,p_fence)
 AND EXISTS(SELECT 1 FROM hoopcheck_deletion_private.worker_state w WHERE w.request_id=p_request AND w.next_step=4)
 AND EXISTS(SELECT 1 FROM hoopcheck_deletion_private.frozen_accounts f WHERE f.owner_id=p_owner AND f.request_id=p_request)
 AND NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=p_owner);
END $$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.verify_frozen_session_absence(uuid,uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.verify_frozen_session_absence(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.verify_deletion_session_absence(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT hoopcheck_deletion_private.verify_frozen_session_absence(p_request,p_owner,p_fence)
$$;
REVOKE ALL ON FUNCTION public.verify_deletion_session_absence(uuid,uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.verify_deletion_session_absence(uuid,uuid,uuid) TO service_role;
-- Auth sign-out and blocking new Auth sign-ins are separate effects.
-- Retain the freeze until all issued tokens expire; approve minimal retention
-- and cleanup policy before releasing. No hosted changes are authorized.

-- Exact step-4 gate before performing Auth Admin effects; never disclose
-- account state to an arbitrary caller. The worker's bearer is not a user JWT.
CREATE OR REPLACE FUNCTION hoopcheck_deletion_private.assert_frozen_session_step(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.assert_account_deletion_worker(p_request,p_owner,p_fence)
 AND EXISTS(SELECT 1 FROM hoopcheck_deletion_private.worker_state w WHERE w.request_id=p_request AND w.next_step=4)
 AND EXISTS(SELECT 1 FROM hoopcheck_deletion_private.worker_receipts r WHERE r.request_id=p_request AND r.step_number=3)
 AND EXISTS(SELECT 1 FROM hoopcheck_deletion_private.frozen_accounts f WHERE f.owner_id=p_owner AND f.request_id=p_request)
$$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.assert_frozen_session_step(uuid,uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.assert_frozen_session_step(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.assert_deletion_frozen_session_step(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT hoopcheck_deletion_private.assert_frozen_session_step(p_request,p_owner,p_fence)
$$;
REVOKE ALL ON FUNCTION public.assert_deletion_frozen_session_step(uuid,uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.assert_deletion_frozen_session_step(uuid,uuid,uuid) TO service_role;

-- Separate proof of a long-enough Auth ban, not a claim that banning revokes sessions.
CREATE OR REPLACE FUNCTION hoopcheck_deletion_private.verify_auth_login_block(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT hoopcheck_deletion_private.assert_frozen_session_step(p_request,p_owner,p_fence)
 AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_owner AND u.banned_until>now()+interval '7 days')
$$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.verify_auth_login_block(uuid,uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.verify_auth_login_block(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.verify_deletion_auth_login_block(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT hoopcheck_deletion_private.verify_auth_login_block(p_request,p_owner,p_fence)
$$;
REVOKE ALL ON FUNCTION public.verify_deletion_auth_login_block(uuid,uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.verify_deletion_auth_login_block(uuid,uuid,uuid) TO service_role;
