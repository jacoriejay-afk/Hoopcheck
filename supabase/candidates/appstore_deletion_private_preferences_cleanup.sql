-- REVIEW ONLY. Apply after the deletion freeze and worker state candidates.
-- This is one sub-operation of step 8, NOT proof of complete relational erasure.
-- Six private owner-scoped tables checked against live catalog 2026-11-26.
-- No reviews, posts, shared groups, financial data, or auth rows are modified.
CREATE OR REPLACE FUNCTION hoopcheck_deletion_private.erase_private_preferences(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 tables text[]:=ARRAY['fan_feed_archives','fan_live_game_reminders','feed_post_archives','feed_post_bookmarks','user_preferences','user_watchlists'];
 t text; relation oid; remaining boolean;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,17001));
 PERFORM 1 FROM hoopcheck_deletion_private.worker_state w JOIN public.account_deletion_requests r ON r.id=w.request_id
 WHERE w.request_id=p_request AND r.user_id=p_owner AND w.fence=p_fence FOR UPDATE OF r,w;
 IF NOT FOUND OR NOT public.assert_account_deletion_worker(p_request,p_owner,p_fence)
 OR NOT EXISTS(SELECT 1 FROM hoopcheck_deletion_private.worker_state w WHERE w.request_id=p_request AND w.next_step=8)
 OR (SELECT count(*) FROM hoopcheck_deletion_private.worker_receipts r WHERE r.request_id=p_request AND r.step_number BETWEEN 1 AND 7)<>7
 OR NOT EXISTS(SELECT 1 FROM hoopcheck_deletion_private.frozen_accounts f WHERE f.request_id=p_request AND f.owner_id=p_owner)
 THEN RETURN false; END IF;
 -- Fixed allowlist only. Validate every relation and hold a lock against
 -- schema changes before starting any deletes. Fail atomically on drift.
 FOREACH t IN ARRAY tables LOOP
  relation:=to_regclass(format('public.%I',t));
  IF relation IS NULL THEN RAISE EXCEPTION 'Approved preference table missing'; END IF;
  EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',t);
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid=relation AND c.relkind='r')
  OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=relation AND a.attname='user_id' AND a.atttypid='uuid'::regtype AND NOT a.attisdropped)
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.contype='f' AND c.confrelid=relation)
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger g WHERE g.tgrelid=relation AND NOT g.tgisinternal)
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite rw WHERE rw.ev_class=relation)
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhrelid=relation OR i.inhparent=relation)
  THEN RAISE EXCEPTION 'Preference cleanup scope drift'; END IF;
 END LOOP;
 IF NOT public.assert_account_deletion_worker(p_request,p_owner,p_fence) THEN RETURN false; END IF;
 FOREACH t IN ARRAY tables LOOP
  EXECUTE format('DELETE FROM public.%I WHERE user_id=$1',t) USING p_owner;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE user_id=$1)',t) INTO remaining USING p_owner;
  IF remaining THEN RAISE EXCEPTION 'Preference cleanup not confirmed'; END IF;
 END LOOP;
 IF NOT public.assert_account_deletion_worker(p_request,p_owner,p_fence) THEN RAISE EXCEPTION 'Preference cleanup lease expired' USING ERRCODE='42501'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.erase_private_preferences(uuid,uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.erase_private_preferences(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.erase_approved_deletion_preferences(p_request uuid,p_owner uuid,p_fence uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT hoopcheck_deletion_private.erase_private_preferences(p_request,p_owner,p_fence)
$$;
REVOKE ALL ON FUNCTION public.erase_approved_deletion_preferences(uuid,uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.erase_approved_deletion_preferences(uuid,uuid,uuid) TO service_role;
-- Keep worker disabled until every remaining data category and external
-- provider is classified and verified; never record a full step-8 receipt
-- solely because this function returned true.
