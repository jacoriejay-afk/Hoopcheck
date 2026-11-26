-- REVIEW ONLY: durable, encrypted completion contact and delivery state.
-- Apply after worker state. Do not enable worker or send live mail here.
CREATE TABLE IF NOT EXISTS hoopcheck_deletion_private.completion_delivery(
 request_id uuid PRIMARY KEY REFERENCES public.account_deletion_requests(id) ON DELETE RESTRICT,
 envelope text CHECK(envelope IS NULL OR (length(envelope)<=2048 AND envelope ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$')),
 first_attempt_at timestamptz,
 provider_id uuid,
 delivered_at timestamptz,
 scrubbed_at timestamptz,
 CHECK(provider_id IS NULL OR first_attempt_at IS NOT NULL),
 CHECK(scrubbed_at IS NULL OR (envelope IS NULL AND provider_id IS NULL AND delivered_at IS NOT NULL))
);
ALTER TABLE hoopcheck_deletion_private.completion_delivery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_deletion_private.completion_delivery FROM public,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION hoopcheck_deletion_private.completion_delivery_action(p_request uuid,p_owner uuid,p_fence uuid,p_action text,p_envelope text,p_provider uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pos integer; d hoopcheck_deletion_private.completion_delivery; required_step integer;
BEGIN
 required_step:=CASE WHEN p_action IN ('capture','capture_read') THEN 2 WHEN p_action IN ('begin','read','accepted','delivered') THEN 11 WHEN p_action='scrub' THEN 12 END;
 IF required_step IS NULL THEN RAISE EXCEPTION 'Unknown completion action'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,17001));
 SELECT w.next_step INTO pos FROM hoopcheck_deletion_private.worker_state w JOIN public.account_deletion_requests r ON r.id=w.request_id
 WHERE w.request_id=p_request AND r.user_id=p_owner AND w.fence=p_fence FOR UPDATE OF r,w;
 IF NOT FOUND OR pos<>required_step OR NOT public.assert_account_deletion_worker(p_request,p_owner,p_fence)
 OR (SELECT count(*) FROM hoopcheck_deletion_private.worker_receipts WHERE request_id=p_request AND step_number<required_step)<>required_step-1
 THEN RAISE EXCEPTION 'Completion action not approved' USING ERRCODE='42501'; END IF;
 IF required_step>=11 AND EXISTS(SELECT 1 FROM auth.users WHERE id=p_owner) THEN RAISE EXCEPTION 'Auth identity remains'; END IF;
 SELECT * INTO d FROM hoopcheck_deletion_private.completion_delivery WHERE request_id=p_request FOR UPDATE;
 IF p_action='capture_read' THEN RETURN jsonb_build_object('envelope',d.envelope); END IF;
 IF p_action='capture' THEN
  IF p_envelope IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_owner AND email IS NOT NULL AND email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Verified completion contact required'; END IF;
  INSERT INTO hoopcheck_deletion_private.completion_delivery(request_id,envelope) VALUES(p_request,p_envelope)
  ON CONFLICT(request_id) DO NOTHING;
  SELECT * INTO d FROM hoopcheck_deletion_private.completion_delivery WHERE request_id=p_request;
  IF d.envelope IS DISTINCT FROM p_envelope THEN RAISE EXCEPTION 'Existing completion contact differs'; END IF;
  RETURN jsonb_build_object('ok',true);
 END IF;
 IF d.request_id IS NULL THEN RAISE EXCEPTION 'Missing completion contact'; END IF;
 IF p_action='scrub' THEN
  IF d.delivered_at IS NULL THEN RAISE EXCEPTION 'Delivery not confirmed'; END IF;
  UPDATE hoopcheck_deletion_private.completion_delivery SET envelope=NULL,provider_id=NULL,first_attempt_at=NULL,scrubbed_at=coalesce(scrubbed_at,now()) WHERE request_id=p_request;
  RETURN jsonb_build_object('ok',true);
 END IF;
 IF d.envelope IS NULL THEN RAISE EXCEPTION 'Missing encrypted contact'; END IF;
 IF p_action='begin' THEN
  UPDATE hoopcheck_deletion_private.completion_delivery SET first_attempt_at=coalesce(first_attempt_at,now()) WHERE request_id=p_request RETURNING * INTO d;
 ELSIF p_action='accepted' THEN
  IF p_provider IS NULL OR d.first_attempt_at IS NULL OR (d.provider_id IS NOT NULL AND d.provider_id<>p_provider) THEN RAISE EXCEPTION 'Delivery acknowledgement mismatch'; END IF;
  UPDATE hoopcheck_deletion_private.completion_delivery SET provider_id=p_provider WHERE request_id=p_request RETURNING * INTO d;
 ELSIF p_action='delivered' THEN
  IF p_provider IS NULL OR d.provider_id IS DISTINCT FROM p_provider THEN RAISE EXCEPTION 'Delivery acknowledgement mismatch'; END IF;
  UPDATE hoopcheck_deletion_private.completion_delivery SET delivered_at=coalesce(delivered_at,now()) WHERE request_id=p_request RETURNING * INTO d;
 END IF;
 RETURN jsonb_build_object('envelope',d.envelope,'first_attempt_at',d.first_attempt_at,'provider_id',d.provider_id,'delivered',d.delivered_at IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.completion_delivery_action(uuid,uuid,uuid,text,text,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.completion_delivery_action(uuid,uuid,uuid,text,text,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.account_deletion_completion_action(p_request uuid,p_owner uuid,p_fence uuid,p_action text,p_envelope text DEFAULT NULL,p_provider uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT hoopcheck_deletion_private.completion_delivery_action(p_request,p_owner,p_fence,p_action,p_envelope,p_provider)
$$;
REVOKE ALL ON FUNCTION public.account_deletion_completion_action(uuid,uuid,uuid,text,text,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.account_deletion_completion_action(uuid,uuid,uuid,text,text,uuid) TO service_role;
-- Remaining metadata is subject to approved retention; no recipient is retained
-- in plaintext here. The provider's message retention requires separate review.
