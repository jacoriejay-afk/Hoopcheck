-- REVIEW ONLY. Install after worker/freeze candidates. Default has no approvals.
-- Implements deletion of an owner's reviews, comments and likes only after
-- an operator has reviewed the EXACT thread/report/moderation dependency set.
-- Moderation/report evidence is NOT deleted by this candidate. Resolve lawful
-- retention or holds separately first. No automatic anonymous aggregate retention.
CREATE TABLE IF NOT EXISTS hoopcheck_deletion_private.review_cleanup_approvals(
 request_id uuid PRIMARY KEY REFERENCES public.account_deletion_requests(id) ON DELETE RESTRICT,
 policy_version text NOT NULL,
 scope_digest text NOT NULL CHECK(scope_digest ~ '^[a-f0-9]{64}$'),
 approved_at timestamptz NOT NULL DEFAULT now(),
 -- Explicit acknowledgement that other users' comments/likes on removed
 -- reviews also disappear. No approval of deleting third-party reports.
 allow_thread_removal boolean NOT NULL DEFAULT false
);
ALTER TABLE hoopcheck_deletion_private.review_cleanup_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_deletion_private.review_cleanup_approvals FROM public,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION hoopcheck_deletion_private.review_cleanup_scope(p_request uuid,p_owner uuid,p_fence uuid,p_apply boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE scope jsonb; digest text; approved hoopcheck_deletion_private.review_cleanup_approvals; t text; relation oid; expected integer; affected integer; version text;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,17001));
 SELECT w.policy_version INTO version FROM hoopcheck_deletion_private.worker_state w JOIN public.account_deletion_requests r ON r.id=w.request_id
 WHERE w.request_id=p_request AND r.user_id=p_owner AND w.next_step=8 AND w.fence=p_fence FOR UPDATE OF r,w;
 IF NOT FOUND OR NOT public.assert_account_deletion_worker(p_request,p_owner,p_fence)
 OR NOT EXISTS(SELECT 1 FROM hoopcheck_deletion_private.frozen_accounts f WHERE f.request_id=p_request AND f.owner_id=p_owner)
 THEN RAISE EXCEPTION 'Review cleanup not approved' USING ERRCODE='42501'; END IF;
 -- Fixed set, deterministic locking and fail-closed catalog checks.
 FOREACH t IN ARRAY ARRAY['review_comments','review_likes','review_moderation_events','review_reports','reviews','womens_team_reviews'] LOOP
  relation:=to_regclass(format('public.%I',t));
  IF relation IS NULL THEN RAISE EXCEPTION 'Review dependency missing'; END IF;
  EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',t);
  expected:=CASE t WHEN 'reviews' THEN 4 WHEN 'review_reports' THEN 1 ELSE 0 END;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid=relation AND c.relkind='r')
   OR (SELECT count(*) FROM pg_catalog.pg_constraint k WHERE k.contype='f' AND k.confrelid=relation)<>expected
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger g WHERE g.tgrelid=relation AND NOT g.tgisinternal AND (g.tgtype::int & 8)<>0)
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite rw WHERE rw.ev_class=relation)
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhrelid=relation OR i.inhparent=relation)
  THEN RAISE EXCEPTION 'Review cleanup schema drift'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_catalog.pg_constraint k WHERE k.contype='f' AND k.confrelid='public.reviews'::regclass
 AND k.confdeltype='c' AND (k.conrelid,k.conname) IN (
 ('public.review_comments'::regclass,'review_comments_review_id_fkey'),
 ('public.review_likes'::regclass,'review_likes_review_id_fkey'),
 ('public.review_reports'::regclass,'review_reports_review_id_fkey'),
 ('public.review_moderation_events'::regclass,'review_moderation_events_review_id_fkey')))<>4
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint k WHERE k.contype='f' AND k.confrelid='public.review_reports'::regclass AND k.conrelid='public.review_moderation_events'::regclass AND k.conname='review_moderation_events_report_id_fkey' AND k.confdeltype='c')
 THEN RAISE EXCEPTION 'Review cleanup relationship drift'; END IF;
 -- Scope is bound to exact record IDs, not just counts. IDs never leave DB.
 SELECT jsonb_build_object(
 'reviews',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.reviews WHERE author_id=p_owner),'[]'::jsonb),
 'women',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.womens_team_reviews WHERE author_id=p_owner),'[]'::jsonb),
 'comments',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.review_comments WHERE author_id=p_owner OR review_id IN (SELECT id FROM public.reviews WHERE author_id=p_owner)),'[]'::jsonb),
 'likes',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.review_likes WHERE user_id=p_owner OR review_id IN (SELECT id FROM public.reviews WHERE author_id=p_owner)),'[]'::jsonb),
 'reports',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.review_reports WHERE reporter_id=p_owner OR review_id IN (SELECT id FROM public.reviews WHERE author_id=p_owner)),'[]'::jsonb),
 'moderation',coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.review_moderation_events WHERE actor_id=p_owner OR review_id IN (SELECT id FROM public.reviews WHERE author_id=p_owner) OR report_id IN (SELECT id FROM public.review_reports WHERE reporter_id=p_owner OR review_id IN (SELECT id FROM public.reviews WHERE author_id=p_owner))),'[]'::jsonb),
 'third_party', (SELECT count(*) FROM public.review_comments WHERE author_id IS DISTINCT FROM p_owner AND review_id IN (SELECT id FROM public.reviews WHERE author_id=p_owner))+(SELECT count(*) FROM public.review_likes WHERE user_id IS DISTINCT FROM p_owner AND review_id IN (SELECT id FROM public.reviews WHERE author_id=p_owner))
 ) INTO scope;
 digest:=encode(pg_catalog.sha256(convert_to(jsonb_build_array(p_request,p_owner,version,scope)::text,'UTF8')),'hex');
 IF NOT p_apply THEN RETURN jsonb_build_object('scope_digest',digest,'reviews',jsonb_array_length(scope->'reviews'),'women',jsonb_array_length(scope->'women'),'comments',jsonb_array_length(scope->'comments'),'likes',jsonb_array_length(scope->'likes'),'reports',jsonb_array_length(scope->'reports'),'moderation',jsonb_array_length(scope->'moderation'),'third_party',scope->'third_party'); END IF;
 -- Preserve report/moderation evidence until a separate approved retention path.
 IF jsonb_array_length(scope->'reports')<>0 OR jsonb_array_length(scope->'moderation')<>0 THEN RAISE EXCEPTION 'Review evidence requires retention disposition'; END IF;
 IF jsonb_array_length(scope->'reviews')+jsonb_array_length(scope->'women')+jsonb_array_length(scope->'comments')+jsonb_array_length(scope->'likes')=0 THEN RETURN jsonb_build_object('ok',true); END IF;
 SELECT * INTO approved FROM hoopcheck_deletion_private.review_cleanup_approvals WHERE request_id=p_request AND policy_version=version AND scope_digest=digest;
 IF NOT FOUND OR ((scope->>'third_party')::bigint>0 AND NOT approved.allow_thread_removal) THEN RAISE EXCEPTION 'Exact review scope approval required'; END IF;
 IF NOT public.assert_account_deletion_worker(p_request,p_owner,p_fence) THEN RAISE EXCEPTION 'Review cleanup lease expired' USING ERRCODE='42501'; END IF;
 DELETE FROM public.review_comments WHERE author_id=p_owner OR review_id IN (SELECT id FROM public.reviews WHERE author_id=p_owner);
 DELETE FROM public.review_likes WHERE user_id=p_owner OR review_id IN (SELECT id FROM public.reviews WHERE author_id=p_owner);
 DELETE FROM public.reviews WHERE author_id=p_owner;
 DELETE FROM public.womens_team_reviews WHERE author_id=p_owner;
 IF EXISTS(SELECT 1 FROM public.reviews WHERE author_id=p_owner) OR EXISTS(SELECT 1 FROM public.womens_team_reviews WHERE author_id=p_owner)
 OR EXISTS(SELECT 1 FROM public.review_comments WHERE author_id=p_owner) OR EXISTS(SELECT 1 FROM public.review_likes WHERE user_id=p_owner)
 THEN RAISE EXCEPTION 'Review cleanup not confirmed'; END IF;
 IF NOT public.assert_account_deletion_worker(p_request,p_owner,p_fence) THEN RAISE EXCEPTION 'Review cleanup lease expired' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.review_cleanup_scope(uuid,uuid,uuid,boolean) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.review_cleanup_scope(uuid,uuid,uuid,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.approved_deletion_review_scope(p_request uuid,p_owner uuid,p_fence uuid,p_apply boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT hoopcheck_deletion_private.review_cleanup_scope(p_request,p_owner,p_fence,p_apply)
$$;
REVOKE ALL ON FUNCTION public.approved_deletion_review_scope(uuid,uuid,uuid,boolean) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.approved_deletion_review_scope(uuid,uuid,uuid,boolean) TO service_role;
-- Sub-operation only; never use this alone as step-8 receipt. Review-derived
-- caches, text snapshots, external copies and lawful evidence need separate checks.
