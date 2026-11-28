-- REVIEW ONLY. Installs after deletion worker/freeze and durable export media.
-- Scope covers only derived export copies, never source records or originals.
BEGIN;
CREATE TABLE hoopcheck_deletion_private.export_cleanup_approvals(
 request_id uuid PRIMARY KEY REFERENCES public.account_deletion_requests(id) ON DELETE RESTRICT,
 policy_version text NOT NULL,
 legal_hold_cleared boolean NOT NULL DEFAULT false
);
CREATE TABLE hoopcheck_deletion_private.export_cleanup_receipts(
 request_id uuid PRIMARY KEY REFERENCES public.account_deletion_requests(id) ON DELETE RESTRICT,
 policy_version text NOT NULL,
 removed_jobs integer NOT NULL CHECK(removed_jobs>=0)
);
ALTER TABLE hoopcheck_deletion_private.export_cleanup_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_deletion_private.export_cleanup_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_deletion_private.export_cleanup_approvals,hoopcheck_deletion_private.export_cleanup_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hoopcheck_deletion_private.scrub_approved_account_exports(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE version text; n integer; existing hoopcheck_deletion_private.export_cleanup_receipts%ROWTYPE;
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text,17001));
 SELECT w.policy_version INTO version FROM hoopcheck_deletion_private.worker_state w JOIN public.account_deletion_requests r ON r.id=w.request_id
 WHERE r.id=p_request AND r.user_id=p_owner AND w.fence=p_fence AND w.next_step=8 FOR UPDATE OF r,w;
 IF NOT FOUND OR NOT coalesce(public.assert_account_deletion_worker(p_request,p_owner,p_fence),false)
 OR NOT EXISTS(SELECT 1 FROM hoopcheck_deletion_private.frozen_accounts WHERE request_id=p_request AND owner_id=p_owner)
 THEN RAISE EXCEPTION 'Frozen worker required' USING ERRCODE='42501'; END IF;
 -- Same lock as owner export actions. After a freeze, a waiting request must
 -- reverify its identity before creating a job. Locking job rows waits for
 -- any existing snapshot transaction; a queued worker cannot recreate one.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text,771));
 PERFORM 1 FROM hoopcheck_export_private.jobs WHERE owner_id=p_owner ORDER BY id FOR UPDATE;
 SELECT * INTO existing FROM hoopcheck_deletion_private.export_cleanup_receipts WHERE request_id=p_request;
 IF FOUND THEN
  IF existing.policy_version IS DISTINCT FROM version OR EXISTS(SELECT 1 FROM hoopcheck_export_private.jobs WHERE owner_id=p_owner)
  THEN RAISE EXCEPTION 'Export cleanup receipt inconsistent'; END IF;
  RETURN jsonb_build_object('ok',true,'removed_jobs',existing.removed_jobs);
 END IF;
 PERFORM 1 FROM hoopcheck_deletion_private.export_cleanup_approvals a WHERE request_id=p_request AND a.policy_version=version AND a.legal_hold_cleared FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(public.assert_account_deletion_worker(p_request,p_owner,p_fence),false)
 THEN RAISE EXCEPTION 'Export cleanup not approved' USING ERRCODE='42501'; END IF;
 DELETE FROM hoopcheck_export_private.events e USING hoopcheck_export_private.jobs j WHERE e.job_id=j.id AND j.owner_id=p_owner;
 -- records and media inventory/items cascade through the job. No export
 -- job UUID or old review identifier is retained in the receipt.
 DELETE FROM hoopcheck_export_private.jobs WHERE owner_id=p_owner;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF EXISTS(SELECT 1 FROM hoopcheck_export_private.jobs WHERE owner_id=p_owner)
 OR NOT coalesce(public.assert_account_deletion_worker(p_request,p_owner,p_fence),false)
 THEN RAISE EXCEPTION 'Export cleanup not confirmed'; END IF;
 INSERT INTO hoopcheck_deletion_private.export_cleanup_receipts VALUES(p_request,version,n);
 DELETE FROM hoopcheck_deletion_private.export_cleanup_approvals WHERE request_id=p_request;
 RETURN jsonb_build_object('ok',true,'removed_jobs',n);
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.scrub_approved_account_exports(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.scrub_approved_account_exports(uuid,uuid,uuid) TO service_role;
CREATE FUNCTION public.scrub_approved_deletion_exports(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT hoopcheck_deletion_private.scrub_approved_account_exports(p_request,p_owner,p_fence)
$f$;
REVOKE ALL ON FUNCTION public.scrub_approved_deletion_exports(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.scrub_approved_deletion_exports(uuid,uuid,uuid) TO service_role;
COMMIT;
