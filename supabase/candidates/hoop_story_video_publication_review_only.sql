-- Review-only; depends on the private inspection, transcode and human review candidates.
-- Follower Stories only. No new caption moderation, community audience or Reel
-- access is inferred from a video review. All publishing/signing starts disabled.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='20s';
DO $guard$ BEGIN
 IF to_regprocedure('public.confirm_active_account_session()') IS NULL OR to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NULL
 OR to_regprocedure('private.hoopfeed_can_read_author(uuid)') IS NULL OR to_regprocedure('public.can_use_unified_hoopfeed()') IS NULL
 OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.feed_posts'::regclass AND polname='unified hoopfeed approved posts read' AND polcmd='r')
 OR has_table_privilege('anon','public.feed_posts','SELECT') THEN RAISE EXCEPTION 'Review Story publication baseline';END IF;
END $guard$;
CREATE TABLE hoopcheck_story_inspection.publication_config(singleton boolean PRIMARY KEY CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO hoopcheck_story_inspection.publication_config VALUES(true,false);
CREATE TABLE hoopcheck_story_inspection.publications(
 job_id uuid PRIMARY KEY REFERENCES public.hoop_story_video_jobs(id) ON DELETE RESTRICT,
 post_id uuid UNIQUE REFERENCES public.feed_posts(id) ON DELETE SET NULL,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 fence uuid NOT NULL,video_sha256 text NOT NULL,thumbnail_sha256 text NOT NULL,
 created_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 CHECK(expires_at=created_at+interval '24 hours')
);
ALTER TABLE hoopcheck_story_inspection.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_story_inspection.publication_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_story_inspection.publications,hoopcheck_story_inspection.publication_config FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hoopcheck_story_inspection.approved_current(j public.hoop_story_video_jobs,t hoopcheck_story_inspection.transcodes) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT EXISTS(SELECT FROM hoopcheck_story_inspection.review_config WHERE singleton AND enabled)
 AND hoopcheck_story_inspection.output_current(j,t) AND EXISTS(
 SELECT FROM hoopcheck_story_inspection.reviews r WHERE r.job_id=j.id AND r.fence=t.fence AND r.video_sha256=t.video_sha256 AND r.thumbnail_sha256=t.thumbnail_sha256 AND r.reviewer_id IS NOT NULL AND r.revoked_at IS NULL AND r.visual_decision='approved' AND (r.audio_decision='approved' AND j.inspected_audio OR r.audio_decision='no_audio' AND NOT j.inspected_audio))
$f$;
REVOKE ALL ON FUNCTION hoopcheck_story_inspection.approved_current(public.hoop_story_video_jobs,hoopcheck_story_inspection.transcodes) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.publish_reviewed_story_video(p_job uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE uid uuid:=auth.uid();j public.hoop_story_video_jobs%ROWTYPE;t hoopcheck_story_inspection.transcodes%ROWTYPE;p hoopcheck_story_inspection.publications%ROWTYPE;ts timestamptz:=clock_timestamp();pid uuid;ref text;
BEGIN
 IF uid IS NULL OR public.confirm_active_account_session() IS NOT TRUE OR hoopcheck_security.mfa_satisfied() IS NOT TRUE OR public.can_use_unified_hoopfeed() IS NOT TRUE THEN RAISE EXCEPTION 'Verify account and membership' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_story_inspection.publication_config WHERE singleton AND enabled) THEN RETURN jsonb_build_object('state','disabled');END IF;
 IF NOT EXISTS(SELECT FROM public.profiles WHERE id=uid AND moderation_status IN ('normal','warned','flagged')) THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM public.hoop_story_video_jobs WHERE id=p_job AND owner_id=uid FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','unavailable');END IF;
 SELECT * INTO p FROM hoopcheck_story_inspection.publications WHERE job_id=j.id;
 IF FOUND THEN
  RETURN jsonb_build_object('state',CASE WHEN p.post_id IS NULL THEN 'removed' WHEN p.expires_at<=clock_timestamp() THEN 'expired' WHEN EXISTS(SELECT FROM public.feed_posts WHERE id=p.post_id AND status='approved') AND EXISTS(SELECT FROM hoopcheck_story_inspection.transcodes x WHERE x.job_id=j.id AND hoopcheck_story_inspection.approved_current(j,x)) THEN 'published' ELSE 'unavailable' END,'post_id',p.post_id,'expires_at',p.expires_at);
 END IF;
 SELECT * INTO t FROM hoopcheck_story_inspection.transcodes WHERE job_id=j.id FOR UPDATE;
 IF NOT FOUND OR NOT hoopcheck_story_inspection.approved_current(j,t) THEN RETURN jsonb_build_object('state','unavailable');END IF;
 ref:='hoopfeed-private-videos/story-processed/'||uid||'/'||j.id||'/'||t.fence||'/video.mp4';
 -- Publication only accepts the reviewed asset and a fixed non-user caption.
 -- New user text needs its own moderation and is not accepted here.
 INSERT INTO public.feed_posts(author_id,body,status,post_kind,community_visible,created_at,expires_at,video_url,image_url,image_urls)
 VALUES(uid,'Video Story','approved','story',false,ts,ts+interval '24 hours',ref,NULL,'[]'::jsonb) RETURNING id INTO pid;
 INSERT INTO hoopcheck_story_inspection.publications VALUES(j.id,pid,uid,t.fence,t.video_sha256,t.thumbnail_sha256,ts,ts+interval '24 hours');
 RETURN jsonb_build_object('state','published','post_id',pid,'expires_at',ts+interval '24 hours');
END $f$;
REVOKE ALL ON FUNCTION private.publish_reviewed_story_video(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.publish_reviewed_story_video(uuid) TO authenticated;
CREATE FUNCTION public.publish_reviewed_story_video(p_job uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$ SELECT private.publish_reviewed_story_video(p_job) $f$;
REVOKE ALL ON FUNCTION public.publish_reviewed_story_video(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.publish_reviewed_story_video(uuid) TO authenticated;
-- Row visibility is still subject to the existing caller RLS. This extra
-- restrictive predicate can only narrow visibility, never grant new access.
CREATE FUNCTION private.reviewed_story_video_visible(p_post uuid,p_author uuid,p_ref text,p_expiry timestamptz) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT auth.uid() IS NOT NULL AND public.confirm_active_account_session() IS TRUE AND hoopcheck_security.mfa_satisfied() IS TRUE AND public.can_use_unified_hoopfeed() IS TRUE AND private.hoopfeed_can_read_author(p_author)
 AND EXISTS(SELECT FROM hoopcheck_story_inspection.publication_config WHERE singleton AND enabled)
 AND EXISTS(SELECT FROM hoopcheck_story_inspection.publications p JOIN public.hoop_story_video_jobs j ON j.id=p.job_id JOIN hoopcheck_story_inspection.transcodes t ON t.job_id=j.id
 WHERE p.post_id=p_post AND p.owner_id=p_author AND p.expires_at=p_expiry AND p.expires_at>now() AND p.fence=t.fence AND p.video_sha256=t.video_sha256 AND p.thumbnail_sha256=t.thumbnail_sha256
 AND p_ref='hoopfeed-private-videos/story-processed/'||p.owner_id||'/'||p.job_id||'/'||p.fence||'/video.mp4' AND hoopcheck_story_inspection.approved_current(j,t))
$f$;
REVOKE ALL ON FUNCTION private.reviewed_story_video_visible(uuid,uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.reviewed_story_video_visible(uuid,uuid,text,timestamptz) TO authenticated;
CREATE POLICY reviewed_story_video_read_guard ON public.feed_posts AS RESTRICTIVE FOR SELECT TO authenticated
 USING(CASE WHEN (post_kind='story' AND video_url IS NOT NULL) OR coalesce(video_url,'') LIKE '%story-processed/%' THEN
 post_kind='story' AND status='approved' AND community_visible=false AND shared_post_id IS NULL AND body='Video Story' AND image_url IS NULL AND image_urls='[]'::jsonb AND private.reviewed_story_video_visible(id,author_id,video_url,expires_at)
 ELSE true END);
-- No client mutation can transform an ordinary post into a processed clip
-- or mutate the approved video/author/audience/expiry/caption. Moderation may
-- still hide a published row by changing its status to rejected.
CREATE FUNCTION hoopcheck_story_inspection.guard_published_video() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
BEGIN
 IF TG_OP='UPDATE' AND ((OLD.post_kind='story' AND OLD.video_url IS NOT NULL) OR coalesce(OLD.video_url,'') LIKE '%story-processed/%') THEN
  IF (to_jsonb(OLD)-'status') IS DISTINCT FROM (to_jsonb(NEW)-'status') OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'rejected') THEN RAISE EXCEPTION 'Reviewed video immutable' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 IF (NEW.post_kind='story' AND NEW.video_url IS NOT NULL) OR coalesce(NEW.video_url,'') LIKE '%story-processed/%' THEN
  IF TG_OP<>'INSERT' OR current_user IN ('anon','authenticated','service_role') THEN RAISE EXCEPTION 'Use reviewed publication' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_story_inspection.guard_published_video() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER reviewed_story_video_write_guard BEFORE INSERT OR UPDATE ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION hoopcheck_story_inspection.guard_published_video();
-- Called only after caller RLS verification by the media signer. Rechecks
-- the receipt, moderation and exact storage object before and after signing.
CREATE FUNCTION public.resolve_reviewed_story_video(p_post uuid,p_ref text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE result jsonb;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_story_inspection.publication_config WHERE singleton AND enabled) THEN RETURN NULL;END IF;
 SELECT jsonb_build_object('path',substring(p_ref from length('hoopfeed-private-videos/')+1),'expires_at',p.expires_at,'fence',p.fence,'video_version',t.video_version) INTO result
 FROM hoopcheck_story_inspection.publications p JOIN public.feed_posts f ON f.id=p.post_id JOIN public.hoop_story_video_jobs j ON j.id=p.job_id JOIN hoopcheck_story_inspection.transcodes t ON t.job_id=j.id
 WHERE p.post_id=p_post AND f.author_id=p.owner_id AND f.post_kind='story' AND f.status='approved' AND f.community_visible=false AND f.shared_post_id IS NULL AND f.body='Video Story' AND f.image_url IS NULL AND f.image_urls='[]'::jsonb AND f.video_url=p_ref AND f.expires_at=p.expires_at AND p.expires_at>now()
 AND p.fence=t.fence AND p.video_sha256=t.video_sha256 AND p.thumbnail_sha256=t.thumbnail_sha256 AND p_ref='hoopfeed-private-videos/story-processed/'||p.owner_id||'/'||p.job_id||'/'||p.fence||'/video.mp4' AND hoopcheck_story_inspection.approved_current(j,t);
 RETURN result;
END $f$;
REVOKE ALL ON FUNCTION public.resolve_reviewed_story_video(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.resolve_reviewed_story_video(uuid,text) TO service_role;
COMMIT;
