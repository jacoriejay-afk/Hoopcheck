-- REVIEW ONLY; install after the worker/freeze and review-author ACL candidates.
-- Never apply to hosted databases. No retention approval or activation is seeded.
-- This replaces the destructive review-cleanup route for retention-approved reviews.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='30s';

DO $pre$
BEGIN
 IF to_regprocedure('public.assert_account_deletion_worker(uuid,uuid,uuid)') IS NULL
 OR to_regclass('hoopcheck_deletion_private.frozen_accounts') IS NULL
 OR to_regclass('public.moderation_risk_flags') IS NULL
 OR has_column_privilege('authenticated','public.reviews','author_id','SELECT')
 OR has_column_privilege('authenticated','public.womens_team_reviews','author_id','SELECT')
 OR has_column_privilege('anon','public.reviews','author_id','SELECT')
 OR has_column_privilege('anon','public.womens_team_reviews','author_id','SELECT')
 THEN RAISE EXCEPTION 'Review retention prerequisites missing'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='public.profiles'::regclass
 AND (conrelid,conname) IN (('public.reviews'::regclass,'reviews_author_id_fkey'),
 ('public.womens_team_reviews'::regclass,'womens_team_reviews_author_id_fkey')) AND confdeltype='c')<>2
 THEN RAISE EXCEPTION 'Review author FK drift'; END IF;
 IF EXISTS(SELECT 1 FROM public.womens_team_reviews GROUP BY author_id,womens_team_id HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Duplicate women review targets require reviewed reconciliation'; END IF;
END $pre$;

-- No implicit author removal: profile deletion must wait for explicit
-- erasure or authorized anonymization. NULL is not a substitute identity.
ALTER TABLE public.reviews ALTER COLUMN author_id DROP NOT NULL,
 DROP CONSTRAINT reviews_author_id_fkey,
 ADD CONSTRAINT reviews_author_id_fkey FOREIGN KEY(author_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
 ADD CONSTRAINT retained_review_projection CHECK(author_id IS NOT NULL OR
 (is_anonymous AND title IS NULL AND body='Rating retained after account deletion.' AND player_season='Season not recorded'));
ALTER TABLE public.womens_team_reviews ALTER COLUMN author_id DROP NOT NULL,
 DROP CONSTRAINT womens_team_reviews_author_id_fkey,
 ADD CONSTRAINT womens_team_reviews_author_id_fkey FOREIGN KEY(author_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
 ADD CONSTRAINT retained_womens_review_projection CHECK(author_id IS NOT NULL OR
 (is_anonymous AND title IS NULL AND body='Rating retained after account deletion.'));
CREATE UNIQUE INDEX womens_review_active_author_target_unique
 ON public.womens_team_reviews(author_id,womens_team_id) WHERE author_id IS NOT NULL;

CREATE TABLE hoopcheck_deletion_private.review_retention_config(
 singleton boolean PRIMARY KEY CHECK(singleton), enabled boolean NOT NULL DEFAULT false,
 expiry_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO hoopcheck_deletion_private.review_retention_config(singleton,enabled) VALUES(true,false);
CREATE TABLE hoopcheck_deletion_private.review_retention_approvals(
 request_id uuid PRIMARY KEY REFERENCES public.account_deletion_requests(id) ON DELETE RESTRICT,
 policy_version text NOT NULL,
 scope_digest text NOT NULL CHECK(scope_digest ~ '^[a-f0-9]{64}$'),
 retention_until date NOT NULL,
 legal_hold_cleared boolean NOT NULL DEFAULT false,
 historical_linkage_cleared boolean NOT NULL DEFAULT false,
 expiry_erase_authorized boolean NOT NULL DEFAULT false
);
-- No former owner UUID, original review UUID, or old/new identifier mapping.
-- Verification is captured at retention time; timestamps in public records
-- are reduced to the first day of the UTC month. Recency may consequently change.
CREATE TABLE hoopcheck_deletion_private.retained_review_facts(
 review_id uuid PRIMARY KEY REFERENCES public.reviews(id) ON DELETE CASCADE,
 reviewer_verified boolean NOT NULL, retention_until date NOT NULL,
 legal_hold boolean NOT NULL DEFAULT false,
 expiry_erase_authorized boolean NOT NULL DEFAULT false
);
CREATE TABLE hoopcheck_deletion_private.retained_womens_review_facts(
 review_id uuid PRIMARY KEY REFERENCES public.womens_team_reviews(id) ON DELETE CASCADE,
 reviewer_verified boolean NOT NULL, retention_until date NOT NULL,
 legal_hold boolean NOT NULL DEFAULT false,
 expiry_erase_authorized boolean NOT NULL DEFAULT false
);
CREATE TABLE hoopcheck_deletion_private.review_retention_receipts(
 request_id uuid PRIMARY KEY REFERENCES public.account_deletion_requests(id) ON DELETE RESTRICT,
 policy_version text NOT NULL, retained_count integer NOT NULL CHECK(retained_count>=0)
);
ALTER TABLE hoopcheck_deletion_private.review_retention_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_deletion_private.review_retention_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_deletion_private.retained_review_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_deletion_private.retained_womens_review_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_deletion_private.review_retention_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_deletion_private.review_retention_config,hoopcheck_deletion_private.review_retention_approvals,
 hoopcheck_deletion_private.retained_review_facts,hoopcheck_deletion_private.retained_womens_review_facts,
 hoopcheck_deletion_private.review_retention_receipts FROM PUBLIC,anon,authenticated,service_role;

-- Defense in depth: no client/service insert of detached reviews; no editing
-- retained ratings, target, text, identity or creation time. Status moderation
-- remains available through the pre-existing authorized moderation path.
CREATE FUNCTION hoopcheck_deletion_private.protect_retained_review()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $g$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.author_id IS NULL THEN RAISE EXCEPTION 'Review author required' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.author_id IS NULL THEN
  IF (to_jsonb(NEW)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at'])
  THEN RAISE EXCEPTION 'Retained review is immutable' USING ERRCODE='42501'; END IF;
 ELSIF NEW.author_id IS NULL THEN
  -- The reviewed definer function executes as the table owner. A service
  -- role or moderator cannot manufacture this transition by a direct UPDATE.
  IF current_user IS DISTINCT FROM (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID)
    OR NEW.id=OLD.id OR NEW.status IS DISTINCT FROM OLD.status OR NEW.status<>'approved'
  THEN RAISE EXCEPTION 'Unauthorized review retention transition' USING ERRCODE='42501'; END IF;
 ELSIF NEW.id IS DISTINCT FROM OLD.id THEN
  RAISE EXCEPTION 'Review identity is immutable' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $g$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.protect_retained_review() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER protect_retained_review BEFORE INSERT OR UPDATE ON public.reviews
 FOR EACH ROW EXECUTE FUNCTION hoopcheck_deletion_private.protect_retained_review();
CREATE TRIGGER protect_retained_review BEFORE INSERT OR UPDATE ON public.womens_team_reviews
 FOR EACH ROW EXECUTE FUNCTION hoopcheck_deletion_private.protect_retained_review();

CREATE FUNCTION hoopcheck_deletion_private.retain_approved_reviews(p_request uuid,p_owner uuid,p_fence uuid,p_apply boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $r$
DECLARE ver text; scope jsonb; digest text; verified boolean; n integer; rec record;
 approval hoopcheck_deletion_private.review_retention_approvals%ROWTYPE;
 receipt hoopcheck_deletion_private.review_retention_receipts%ROWTYPE;
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' OR p_apply IS NULL THEN RAISE EXCEPTION 'Worker required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text,17001));
 SELECT w.policy_version INTO ver FROM hoopcheck_deletion_private.worker_state w
 JOIN public.account_deletion_requests r ON r.id=w.request_id
 WHERE w.request_id=p_request AND r.user_id=p_owner AND w.next_step=8 AND w.fence=p_fence FOR UPDATE OF r,w;
 IF NOT FOUND OR NOT coalesce(public.assert_account_deletion_worker(p_request,p_owner,p_fence),false)
 OR NOT EXISTS(SELECT 1 FROM hoopcheck_deletion_private.frozen_accounts f WHERE f.request_id=p_request AND f.owner_id=p_owner)
 OR NOT EXISTS(SELECT 1 FROM hoopcheck_deletion_private.review_retention_config WHERE singleton AND enabled)
 THEN RAISE EXCEPTION 'Review retention unavailable' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM hoopcheck_deletion_private.review_retention_config WHERE singleton AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Review retention unavailable' USING ERRCODE='42501'; END IF;
 -- Exact schema dependencies, then stable scope locks before digest or write.
 -- Unknown incoming FKs or polymorphic content reports require a new reviewed adapter.
 LOCK TABLE public.reviews,public.womens_team_reviews,public.review_comments,public.review_likes,
 public.review_reports,public.review_moderation_events,public.moderation_risk_flags IN SHARE ROW EXCLUSIVE MODE;
 IF (SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='public.reviews'::regclass)<>5
 OR (SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='public.womens_team_reviews'::regclass)<>1
 OR to_regclass('public.content_reports') IS NOT NULL
 THEN RAISE EXCEPTION 'Review retention dependency drift'; END IF;
 SELECT * INTO receipt FROM hoopcheck_deletion_private.review_retention_receipts WHERE request_id=p_request;
 IF FOUND THEN
  IF receipt.policy_version IS DISTINCT FROM ver OR EXISTS(SELECT 1 FROM public.reviews WHERE author_id=p_owner)
  OR EXISTS(SELECT 1 FROM public.womens_team_reviews WHERE author_id=p_owner)
  THEN RAISE EXCEPTION 'Review retention receipt inconsistent'; END IF;
  RETURN jsonb_build_object('ok',true,'retained_count',receipt.retained_count);
 END IF;
 SELECT player_verified IS TRUE INTO verified FROM public.profiles WHERE id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Review owner unavailable'; END IF;
 -- Ineligible and unresolved records stop the entire batch. No deletion or
 -- partial retention is permitted. Moderation/history are not silently erased.
 IF EXISTS(SELECT 1 FROM public.reviews WHERE author_id=p_owner AND (status<>'approved' OR legal_review_required))
 OR EXISTS(SELECT 1 FROM public.womens_team_reviews WHERE author_id=p_owner AND status<>'approved')
 OR EXISTS(SELECT 1 FROM public.review_comments c JOIN public.reviews r ON r.id=c.review_id WHERE r.author_id=p_owner)
 OR EXISTS(SELECT 1 FROM public.review_likes c JOIN public.reviews r ON r.id=c.review_id WHERE r.author_id=p_owner)
 OR EXISTS(SELECT 1 FROM public.review_reports c JOIN public.reviews r ON r.id=c.review_id WHERE r.author_id=p_owner)
 OR EXISTS(SELECT 1 FROM public.review_moderation_events c JOIN public.reviews r ON r.id=c.review_id WHERE r.author_id=p_owner)
 OR EXISTS(SELECT 1 FROM public.moderation_risk_flags f WHERE f.content_type='review' AND
  (EXISTS(SELECT 1 FROM public.reviews r WHERE r.id=f.content_id AND r.author_id=p_owner)
   OR EXISTS(SELECT 1 FROM public.womens_team_reviews r WHERE r.id=f.content_id AND r.author_id=p_owner)))
 THEN RAISE EXCEPTION 'Review history requires separately approved disposition'; END IF;
 SELECT jsonb_build_array(p_request,p_owner,ver,verified,
  coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.reviews r WHERE author_id=p_owner),'[]'::jsonb),
  coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.womens_team_reviews r WHERE author_id=p_owner),'[]'::jsonb)) INTO scope;
 digest:=encode(sha256(convert_to(scope::text,'UTF8')),'hex');
 n:=jsonb_array_length(scope->4)+jsonb_array_length(scope->5);
 IF NOT p_apply THEN RETURN jsonb_build_object('scope_digest',digest,'eligible_count',n); END IF;
 SELECT * INTO approval FROM hoopcheck_deletion_private.review_retention_approvals WHERE request_id=p_request FOR UPDATE;
 IF NOT FOUND OR approval.policy_version IS DISTINCT FROM ver OR approval.scope_digest IS DISTINCT FROM digest
 OR NOT approval.legal_hold_cleared OR NOT approval.historical_linkage_cleared
 OR approval.retention_until<=(clock_timestamp() AT TIME ZONE 'UTC')::date
 OR NOT coalesce(public.assert_account_deletion_worker(p_request,p_owner,p_fence),false)
 THEN RAISE EXCEPTION 'Exact retention approval required' USING ERRCODE='42501'; END IF;
 -- Update in place (one contribution per existing row), rotate its identifier,
 -- strip free text, author and season; never copy a rating into a second row.
 FOR rec IN UPDATE public.reviews SET id=gen_random_uuid(),author_id=NULL,is_anonymous=true,title=NULL,
  body='Rating retained after account deletion.',player_season='Season not recorded',
  created_at=date_trunc('month',created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
  updated_at=date_trunc('month',created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
  WHERE author_id=p_owner RETURNING id
 LOOP
  INSERT INTO hoopcheck_deletion_private.retained_review_facts(review_id,reviewer_verified,retention_until,expiry_erase_authorized)
  VALUES(rec.id,verified,approval.retention_until,approval.expiry_erase_authorized);
 END LOOP;
 FOR rec IN UPDATE public.womens_team_reviews SET id=gen_random_uuid(),author_id=NULL,is_anonymous=true,title=NULL,
  body='Rating retained after account deletion.',
  created_at=date_trunc('month',created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
  WHERE author_id=p_owner RETURNING id
 LOOP
  INSERT INTO hoopcheck_deletion_private.retained_womens_review_facts(review_id,reviewer_verified,retention_until,expiry_erase_authorized)
  VALUES(rec.id,verified,approval.retention_until,approval.expiry_erase_authorized);
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.reviews WHERE author_id=p_owner)
 OR EXISTS(SELECT 1 FROM public.womens_team_reviews WHERE author_id=p_owner)
 OR NOT coalesce(public.assert_account_deletion_worker(p_request,p_owner,p_fence),false)
 THEN RAISE EXCEPTION 'Review retention not confirmed'; END IF;
 INSERT INTO hoopcheck_deletion_private.review_retention_receipts VALUES(p_request,ver,n);
 DELETE FROM hoopcheck_deletion_private.review_retention_approvals WHERE request_id=p_request;
 RETURN jsonb_build_object('ok',true,'retained_count',n);
END $r$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.retain_approved_reviews(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.retain_approved_reviews(uuid,uuid,uuid,boolean) TO service_role;
CREATE FUNCTION public.retain_approved_deletion_reviews(p_request uuid,p_owner uuid,p_fence uuid,p_apply boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $r$
 SELECT hoopcheck_deletion_private.retain_approved_reviews(p_request,p_owner,p_fence,p_apply)
$r$;
REVOKE ALL ON FUNCTION public.retain_approved_deletion_reviews(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.retain_approved_deletion_reviews(uuid,uuid,uuid,boolean) TO service_role;

-- Only server trust calculation consumes this; neither the owner export nor a
-- public API receives any per-review retention metadata or former identity.
CREATE FUNCTION hoopcheck_deletion_private.retained_trust_facts(p_kind text,p_ids uuid[])
RETURNS TABLE(review_id uuid,reviewer_verified boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' OR p_kind IS NULL OR p_kind NOT IN ('men','women')
 OR p_ids IS NULL OR cardinality(p_ids)>1000 THEN RAISE EXCEPTION 'Invalid trust request' USING ERRCODE='42501'; END IF;
 IF p_kind='men' THEN
  RETURN QUERY SELECT f.review_id,f.reviewer_verified FROM hoopcheck_deletion_private.retained_review_facts f
   JOIN public.reviews r ON r.id=f.review_id WHERE f.review_id=ANY(p_ids) AND r.author_id IS NULL AND r.status='approved';
 ELSE
  RETURN QUERY SELECT f.review_id,f.reviewer_verified FROM hoopcheck_deletion_private.retained_womens_review_facts f
   JOIN public.womens_team_reviews r ON r.id=f.review_id WHERE f.review_id=ANY(p_ids) AND r.author_id IS NULL AND r.status='approved';
 END IF;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.retained_trust_facts(text,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.retained_trust_facts(text,uuid[]) TO service_role;
CREATE FUNCTION public.get_retained_review_trust_facts(p_kind text,p_ids uuid[])
RETURNS TABLE(review_id uuid,reviewer_verified boolean) LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT * FROM hoopcheck_deletion_private.retained_trust_facts(p_kind,p_ids)
$f$;
REVOKE ALL ON FUNCTION public.get_retained_review_trust_facts(text,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_retained_review_trust_facts(text,uuid[]) TO service_role;
-- Separate expiry authorization; a retained review is never hard-deleted by
-- a moderator, normal service-role route, or premature parent cascade.
CREATE FUNCTION hoopcheck_deletion_private.protect_retained_review_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $x$
DECLARE allowed boolean;
BEGIN
 IF OLD.author_id IS NOT NULL THEN RETURN OLD; END IF;
 IF current_user IS DISTINCT FROM (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID)
 OR NOT EXISTS(SELECT 1 FROM hoopcheck_deletion_private.review_retention_config WHERE singleton AND expiry_enabled)
 THEN RAISE EXCEPTION 'Retained review deletion not authorized' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='reviews' THEN
  SELECT expiry_erase_authorized AND NOT legal_hold AND retention_until<=(clock_timestamp() AT TIME ZONE 'UTC')::date
  INTO allowed FROM hoopcheck_deletion_private.retained_review_facts WHERE review_id=OLD.id FOR UPDATE;
 ELSE
  SELECT expiry_erase_authorized AND NOT legal_hold AND retention_until<=(clock_timestamp() AT TIME ZONE 'UTC')::date
  INTO allowed FROM hoopcheck_deletion_private.retained_womens_review_facts WHERE review_id=OLD.id FOR UPDATE;
 END IF;
 IF NOT coalesce(allowed,false) THEN RAISE EXCEPTION 'Retained review deletion not authorized' USING ERRCODE='42501'; END IF;
 RETURN OLD;
END $x$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.protect_retained_review_delete() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER protect_retained_review_delete BEFORE DELETE ON public.reviews
 FOR EACH ROW EXECUTE FUNCTION hoopcheck_deletion_private.protect_retained_review_delete();
CREATE TRIGGER protect_retained_review_delete BEFORE DELETE ON public.womens_team_reviews
 FOR EACH ROW EXECUTE FUNCTION hoopcheck_deletion_private.protect_retained_review_delete();

CREATE TABLE hoopcheck_deletion_private.review_expiry_runs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 processed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 erased_count integer NOT NULL CHECK(erased_count>=0),
 blocked_count integer NOT NULL CHECK(blocked_count>=0)
);
ALTER TABLE hoopcheck_deletion_private.review_expiry_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_deletion_private.review_expiry_runs FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION hoopcheck_deletion_private.expire_retained_reviews(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $x$
DECLARE item record; n integer:=0; blocked integer:=0; today date:=(clock_timestamp() AT TIME ZONE 'UTC')::date;
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' OR p_limit IS NULL OR p_limit<1 OR p_limit>100
 THEN RAISE EXCEPTION 'Invalid expiry worker' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM hoopcheck_deletion_private.review_retention_config WHERE singleton AND expiry_enabled FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','disabled','erased',0,'blocked',0); END IF;
 LOCK TABLE public.reviews,public.womens_team_reviews,public.review_comments,public.review_likes,
 public.review_reports,public.review_moderation_events,public.moderation_risk_flags IN SHARE ROW EXCLUSIVE MODE;
 IF (SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='public.reviews'::regclass)<>5
 OR (SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='public.womens_team_reviews'::regclass)<>1
 OR to_regclass('public.content_reports') IS NOT NULL
 THEN RAISE EXCEPTION 'Review expiry dependency drift'; END IF;
 FOR item IN SELECT f.review_id,'men'::text AS kind,f.retention_until FROM hoopcheck_deletion_private.retained_review_facts f
 WHERE f.retention_until<=today AND f.expiry_erase_authorized AND NOT f.legal_hold
 AND NOT EXISTS(SELECT 1 FROM public.review_comments c WHERE c.review_id=f.review_id)
 AND NOT EXISTS(SELECT 1 FROM public.review_likes c WHERE c.review_id=f.review_id)
 AND NOT EXISTS(SELECT 1 FROM public.review_reports c WHERE c.review_id=f.review_id)
 AND NOT EXISTS(SELECT 1 FROM public.review_moderation_events c WHERE c.review_id=f.review_id)
 AND NOT EXISTS(SELECT 1 FROM public.moderation_risk_flags c WHERE c.content_type='review' AND c.content_id=f.review_id)
 UNION ALL
 SELECT f.review_id,'women'::text,f.retention_until FROM hoopcheck_deletion_private.retained_womens_review_facts f
 WHERE f.retention_until<=today AND f.expiry_erase_authorized AND NOT f.legal_hold
 AND NOT EXISTS(SELECT 1 FROM public.moderation_risk_flags c WHERE c.content_type='review' AND c.content_id=f.review_id)
 ORDER BY retention_until,kind,review_id LIMIT p_limit
 LOOP
  -- The trigger rechecks the policy and locks the exact fact. A new legal
  -- hold causes a rollback, never an unauthorized erase.
  IF item.kind='men' THEN
   DELETE FROM public.reviews WHERE id=item.review_id AND author_id IS NULL;
  ELSE
   DELETE FROM public.womens_team_reviews WHERE id=item.review_id AND author_id IS NULL;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retained review expiry not confirmed'; END IF;
  n:=n+1;
 END LOOP;
 -- Counts only. Due records with holds, pending approval or new moderation
 -- dependencies remain intact for separate review. No per-owner audit link.
 SELECT (SELECT count(*) FROM hoopcheck_deletion_private.retained_review_facts WHERE retention_until<=today)
  +(SELECT count(*) FROM hoopcheck_deletion_private.retained_womens_review_facts WHERE retention_until<=today)
 INTO blocked;
 IF n>0 OR blocked>0 THEN INSERT INTO hoopcheck_deletion_private.review_expiry_runs(erased_count,blocked_count) VALUES(n,blocked); END IF;
 RETURN jsonb_build_object('status','checked','erased',n,'blocked',blocked);
END $x$;
REVOKE ALL ON FUNCTION hoopcheck_deletion_private.expire_retained_reviews(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_deletion_private.expire_retained_reviews(integer) TO service_role;
CREATE FUNCTION public.expire_approved_retained_reviews(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $x$
 SELECT hoopcheck_deletion_private.expire_retained_reviews(p_limit)
$x$;
REVOKE ALL ON FUNCTION public.expire_approved_retained_reviews(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.expire_approved_retained_reviews(integer) TO service_role;

COMMIT;
