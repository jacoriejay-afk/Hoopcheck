-- REVIEW ONLY: disposable CI database first. No production activation or seeded jobs.
BEGIN;
CREATE TABLE public.hoopdata_sync_jobs (
  id text PRIMARY KEY CHECK(length(btrim(id)) BETWEEN 1 AND 200),
  pool text NOT NULL CHECK(pool IN ('api-sports-basketball','balldontlie')),
  kind text NOT NULL CHECK(kind IN ('live','schedule','standings','seasons')),
  approved boolean NOT NULL DEFAULT false,
  last_attempt_at timestamptz,
  retry_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_outcome text CHECK(last_outcome IN ('staged','deferred','failed')),
  CHECK((lease_token IS NULL) = (lease_expires_at IS NULL))
);
ALTER TABLE public.hoopdata_sync_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_sync_jobs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.hoopdata_sync_jobs TO service_role;
GRANT UPDATE(last_attempt_at,retry_at,lease_token,lease_expires_at,last_outcome)
  ON public.hoopdata_sync_jobs TO service_role;
-- Trusted server role only. Never grant public clients access. Quota reservation remains
-- a separate mandatory operation before any HTTP attempt; claiming does not spend quota.
CREATE FUNCTION public.hoopdata_claim_sync_job(p_id text,p_pool text,p_kind text)
RETURNS TABLE(id text,token uuid,expires_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $claim$
DECLARE t timestamptz;
BEGIN
  -- Serialize per job before evaluating the database clock.
  PERFORM 1 FROM public.hoopdata_sync_jobs j WHERE j.id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  t:=clock_timestamp();
  RETURN QUERY UPDATE public.hoopdata_sync_jobs j
    SET lease_token=gen_random_uuid(),lease_expires_at=t+interval '60 seconds',last_attempt_at=t
    WHERE j.id=p_id AND j.pool=p_pool AND j.kind=p_kind AND j.approved
      AND (j.lease_expires_at IS NULL OR j.lease_expires_at<=t)
      AND (j.retry_at IS NULL OR j.retry_at<=t)
      AND (j.last_attempt_at IS NULL OR j.last_attempt_at<=t-CASE j.kind
        WHEN 'live' THEN interval '1 minute' WHEN 'schedule' THEN interval '15 minutes'
        WHEN 'standings' THEN interval '1 hour' ELSE interval '24 hours' END)
      AND EXISTS(SELECT 1 FROM public.hoopdata_quota_pools q WHERE q.pool=j.pool AND q.enabled
        AND (q.blocked_until IS NULL OR q.blocked_until<=t))
    RETURNING j.id,j.lease_token,j.lease_expires_at;
END $claim$;
CREATE FUNCTION public.hoopdata_finish_sync_job(p_id text,p_token uuid,p_outcome text,p_retry_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $finish$
DECLARE t timestamptz;
BEGIN
  IF p_token IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('staged','deferred','failed') THEN RETURN false; END IF;
  IF p_outcome='staged' AND p_retry_at IS NOT NULL THEN RETURN false; END IF;
  IF p_retry_at IS NOT NULL AND NOT isfinite(p_retry_at) THEN RETURN false; END IF;
  PERFORM 1 FROM public.hoopdata_sync_jobs j WHERE j.id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  t:=clock_timestamp();
  UPDATE public.hoopdata_sync_jobs j SET last_outcome=p_outcome,
    retry_at=CASE WHEN p_outcome='staged' THEN NULL ELSE greatest(t+interval '60 seconds',p_retry_at) END,
    lease_token=NULL,lease_expires_at=NULL
    WHERE j.id=p_id AND j.approved AND j.lease_token=p_token AND j.lease_expires_at>t;
  RETURN FOUND;
END $finish$;
REVOKE ALL ON FUNCTION public.hoopdata_claim_sync_job(text,text,text),public.hoopdata_finish_sync_job(text,uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoopdata_claim_sync_job(text,text,text),public.hoopdata_finish_sync_job(text,uuid,text,timestamptz) TO service_role;
-- Completion fences job metadata only. Snapshot/canonical writes need their own
-- transactional token check before a dispatcher can be wired to actual providers.
COMMIT;
