-- Review-only. Processing receipts are not content approval. Human review
-- and publication are independently disabled until owner/legal acceptance.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='20s';
CREATE TABLE hoopcheck_story_inspection.review_config(singleton boolean PRIMARY KEY CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO hoopcheck_story_inspection.review_config VALUES(true,false);
ALTER TABLE hoopcheck_story_inspection.review_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_story_inspection.review_config FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE hoopcheck_story_inspection.reviews(
 job_id uuid PRIMARY KEY REFERENCES public.hoop_story_video_jobs(id) ON DELETE CASCADE,
 fence uuid NOT NULL,video_sha256 text NOT NULL CHECK(video_sha256 ~ '^[0-9a-f]{64}$'),thumbnail_sha256 text NOT NULL CHECK(thumbnail_sha256 ~ '^[0-9a-f]{64}$'),
 reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 visual_decision text NOT NULL CHECK(visual_decision IN ('approved','rejected')),
 audio_decision text NOT NULL CHECK(audio_decision IN ('approved','rejected','no_audio')),
 decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_at timestamptz
);
ALTER TABLE hoopcheck_story_inspection.reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_story_inspection.reviews FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hoopcheck_story_inspection.output_current(j public.hoop_story_video_jobs,t hoopcheck_story_inspection.transcodes) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT t.state='ready' AND t.source_digest=j.inspected_sha256 AND hoopcheck_story_inspection.source_current(j) AND EXISTS(
 SELECT FROM storage.objects v JOIN storage.objects thumb ON thumb.id=t.thumbnail_id JOIN storage.buckets b ON b.id=v.bucket_id
 WHERE v.id=t.video_id AND v.version=t.video_version AND thumb.version=t.thumbnail_version AND v.bucket_id='hoopfeed-private-videos' AND thumb.bucket_id=v.bucket_id AND b.public=false
 AND v.name='story-processed/'||j.owner_id||'/'||j.id||'/'||t.fence||'/video.mp4'
 AND thumb.name='story-processed/'||j.owner_id||'/'||j.id||'/'||t.fence||'/thumbnail.jpg'
 AND v.archived_at IS NULL AND thumb.archived_at IS NULL AND NOT v.is_delete_marker AND NOT thumb.is_delete_marker AND NOT v.is_versioned AND NOT thumb.is_versioned
 AND v.metadata->>'mimetype'='video/mp4' AND thumb.metadata->>'mimetype'='image/jpeg')
$f$;
REVOKE ALL ON FUNCTION hoopcheck_story_inspection.output_current(public.hoop_story_video_jobs,hoopcheck_story_inspection.transcodes) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.story_video_owner_status(p_owner uuid,p_job uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE j public.hoop_story_video_jobs%ROWTYPE;t hoopcheck_story_inspection.transcodes%ROWTYPE;r hoopcheck_story_inspection.reviews%ROWTYPE;phase text;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM public.hoop_story_video_jobs WHERE id=p_job AND owner_id=p_owner;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO t FROM hoopcheck_story_inspection.transcodes WHERE job_id=j.id;
 SELECT * INTO r FROM hoopcheck_story_inspection.reviews WHERE job_id=j.id;
 phase:=CASE WHEN j.state='awaiting_upload' THEN 'awaiting_upload'
 WHEN j.inspection_state='rejected' THEN 'rejected'
 WHEN j.inspection_state<>'verified' THEN CASE WHEN j.inspection_attempts>=5 AND j.inspection_until<=now() THEN 'retry_required' ELSE 'inspecting' END
 WHEN t.job_id IS NULL OR t.state='leased' THEN CASE WHEN t.attempts>=5 AND t.lease_until<=now() THEN 'retry_required' ELSE 'transcoding' END
 WHEN t.state='rejected' THEN 'rejected'
 WHEN NOT hoopcheck_story_inspection.output_current(j,t) THEN 'retry_required'
 WHEN r.revoked_at IS NOT NULL OR r.visual_decision='rejected' OR r.audio_decision='rejected' THEN 'rejected'
 WHEN r.job_id IS NOT NULL AND r.fence=t.fence AND r.video_sha256=t.video_sha256 AND r.thumbnail_sha256=t.thumbnail_sha256 AND r.visual_decision='approved' AND (r.audio_decision='approved' AND j.inspected_audio OR r.audio_decision='no_audio' AND NOT j.inspected_audio) THEN 'review_approved'
 ELSE 'awaiting_review' END;
 RETURN jsonb_build_object('id',j.id,'phase',phase,'published',false);
END $f$;
-- The trusted review UI/server must verify the exact reviewer session, MFA,
-- role and explicit visual/audio attestations before invoking these functions.
-- The database also independently requires current administrator/moderator
-- membership. A caller cannot review their own asset.
CREATE FUNCTION public.story_video_review_asset(p_actor uuid,p_job uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE j public.hoop_story_video_jobs%ROWTYPE;t hoopcheck_story_inspection.transcodes%ROWTYPE;prefix text;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_story_inspection.review_config WHERE singleton AND enabled) OR NOT EXISTS(SELECT FROM public.admin_roles WHERE user_id=p_actor AND lower(btrim(role)) IN ('admin','moderator')) THEN RETURN NULL;END IF;
 SELECT * INTO j FROM public.hoop_story_video_jobs WHERE id=p_job AND owner_id<>p_actor AND inspection_state='verified';
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO t FROM hoopcheck_story_inspection.transcodes WHERE job_id=p_job AND state='ready';
 IF NOT FOUND OR NOT hoopcheck_story_inspection.output_current(j,t) THEN RETURN NULL;END IF;
 prefix:='story-processed/'||j.owner_id||'/'||j.id||'/'||t.fence||'/';
 RETURN jsonb_build_object('id',j.id,'fence',t.fence,'video_sha256',t.video_sha256,'thumbnail_sha256',t.thumbnail_sha256,'video_path',prefix||'video.mp4','thumbnail_path',prefix||'thumbnail.jpg','audio',j.inspected_audio);
END $f$;
CREATE FUNCTION public.record_story_video_review(p_actor uuid,p_job uuid,p_fence uuid,p_video_sha256 text,p_thumbnail_sha256 text,p_visual text,p_audio text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE j public.hoop_story_video_jobs%ROWTYPE;t hoopcheck_story_inspection.transcodes%ROWTYPE;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_story_inspection.review_config WHERE singleton AND enabled) OR NOT EXISTS(SELECT FROM public.admin_roles WHERE user_id=p_actor AND lower(btrim(role)) IN ('admin','moderator')) THEN RETURN false;END IF;
 SELECT * INTO j FROM public.hoop_story_video_jobs WHERE id=p_job AND owner_id<>p_actor AND inspection_state='verified' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO t FROM hoopcheck_story_inspection.transcodes WHERE job_id=p_job AND state='ready' AND fence=p_fence FOR UPDATE;
 IF NOT FOUND OR NOT hoopcheck_story_inspection.output_current(j,t) OR t.video_sha256 IS DISTINCT FROM p_video_sha256 OR t.thumbnail_sha256 IS DISTINCT FROM p_thumbnail_sha256 THEN RETURN false;END IF;
 IF p_visual IS NULL OR p_visual NOT IN ('approved','rejected') OR p_audio IS NULL OR p_audio NOT IN ('approved','rejected','no_audio') OR (p_audio='no_audio') IS DISTINCT FROM (NOT j.inspected_audio) THEN RETURN false;END IF;
 INSERT INTO hoopcheck_story_inspection.reviews(job_id,fence,video_sha256,thumbnail_sha256,reviewer_id,visual_decision,audio_decision)
 VALUES(p_job,p_fence,p_video_sha256,p_thumbnail_sha256,p_actor,p_visual,p_audio) ON CONFLICT(job_id) DO NOTHING;
 -- A decision is immutable; same exact request is idempotent. A different
 -- decision requires a separately authorized revocation/review workflow.
 RETURN EXISTS(SELECT FROM hoopcheck_story_inspection.reviews r WHERE r.job_id=p_job AND r.fence=p_fence AND r.video_sha256=p_video_sha256 AND r.thumbnail_sha256=p_thumbnail_sha256 AND r.reviewer_id=p_actor AND r.visual_decision=p_visual AND r.audio_decision=p_audio AND r.revoked_at IS NULL);
END $f$;
REVOKE ALL ON FUNCTION public.story_video_owner_status(uuid,uuid),public.story_video_review_asset(uuid,uuid),public.record_story_video_review(uuid,uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.story_video_owner_status(uuid,uuid),public.story_video_review_asset(uuid,uuid),public.record_story_video_review(uuid,uuid,uuid,text,text,text,text) TO service_role;
COMMIT;
