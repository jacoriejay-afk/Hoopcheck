-- Review-only; depends on hoop_story_video_inspection_review_only.sql.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='20s';
CREATE TABLE hoopcheck_story_inspection.transcode_config(singleton boolean PRIMARY KEY CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO hoopcheck_story_inspection.transcode_config VALUES(true,false);
ALTER TABLE hoopcheck_story_inspection.transcode_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_story_inspection.transcode_config FROM PUBLIC,anon,authenticated,service_role;
-- Every attempt owns unique output paths. A stale attempt cannot overwrite a
-- later attempt or turn a technical receipt into a moderation decision.
CREATE TABLE hoopcheck_story_inspection.transcodes(
 job_id uuid PRIMARY KEY REFERENCES public.hoop_story_video_jobs(id) ON DELETE CASCADE,
 fence uuid NOT NULL, lease_until timestamptz NOT NULL, attempts integer NOT NULL CHECK(attempts BETWEEN 1 AND 5),
 state text NOT NULL CHECK(state IN ('leased','ready','rejected')),
 source_digest text NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 video_id uuid, video_version text, video_sha256 text CHECK(video_sha256 ~ '^[0-9a-f]{64}$'),
 thumbnail_id uuid, thumbnail_version text, thumbnail_sha256 text CHECK(thumbnail_sha256 ~ '^[0-9a-f]{64}$'),
 CHECK(state<>'ready' OR (video_id IS NOT NULL AND video_version IS NOT NULL AND video_sha256 IS NOT NULL AND thumbnail_id IS NOT NULL AND thumbnail_version IS NOT NULL AND thumbnail_sha256 IS NOT NULL))
);
ALTER TABLE hoopcheck_story_inspection.transcodes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_story_inspection.transcodes FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY story_processed_no_client_objects ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING (NOT (bucket_id='hoopfeed-private-videos' AND name LIKE 'story-processed/%'))
 WITH CHECK (NOT (bucket_id='hoopfeed-private-videos' AND name LIKE 'story-processed/%'));
CREATE FUNCTION hoopcheck_story_inspection.source_current(j public.hoop_story_video_jobs) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT EXISTS(SELECT FROM storage.objects s JOIN storage.buckets b ON b.id=s.bucket_id
 WHERE s.id=j.inspected_object AND s.version=j.inspected_version AND s.name=j.object_path AND s.bucket_id='hoopfeed-private-videos'
 AND b.public=false AND s.archived_at IS NULL AND NOT s.is_delete_marker AND NOT s.is_versioned AND s.metadata->>'size'=j.size_bytes::text AND s.metadata->>'mimetype'=j.content_type)
$f$;
REVOKE ALL ON FUNCTION hoopcheck_story_inspection.source_current(public.hoop_story_video_jobs) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.claim_story_video_transcode() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE j public.hoop_story_video_jobs%ROWTYPE; f uuid:=gen_random_uuid(); prefix text;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_story_inspection.transcode_config WHERE singleton AND enabled) THEN RETURN jsonb_build_object('state','disabled'); END IF;
 SELECT x.* INTO j FROM public.hoop_story_video_jobs x LEFT JOIN hoopcheck_story_inspection.transcodes t ON t.job_id=x.id
 WHERE x.state='awaiting_moderation' AND x.inspection_state='verified' AND hoopcheck_story_inspection.source_current(x)
 AND (t.job_id IS NULL OR (t.state='leased' AND t.lease_until<clock_timestamp() AND t.attempts<5))
 ORDER BY x.created_at,x.id LIMIT 1 FOR UPDATE OF x SKIP LOCKED;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','idle'); END IF;
 INSERT INTO hoopcheck_story_inspection.transcodes(job_id,fence,lease_until,attempts,state,source_digest)
 VALUES(j.id,f,clock_timestamp()+interval '10 minutes',1,'leased',j.inspected_sha256)
 ON CONFLICT(job_id) DO UPDATE SET fence=f,lease_until=clock_timestamp()+interval '10 minutes',attempts=transcodes.attempts+1,source_digest=j.inspected_sha256;
 prefix:='story-processed/'||j.owner_id||'/'||j.id||'/'||f||'/';
 RETURN jsonb_build_object('state','leased','id',j.id,'owner_id',j.owner_id,'object_path',j.object_path,'content_type',j.content_type,'size_bytes',j.size_bytes,'declared_duration_ms',j.declared_duration_ms,'fence',f,'object_id',j.inspected_object,'version',j.inspected_version,'source_digest',j.inspected_sha256,'duration_ms',j.inspected_duration_ms,'audio',j.inspected_audio,'video_path',prefix||'video.mp4','thumbnail_path',prefix||'thumbnail.jpg');
END $f$;
CREATE FUNCTION public.finish_story_video_transcode(p_id uuid,p_fence uuid,p_result jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE j public.hoop_story_video_jobs%ROWTYPE; t hoopcheck_story_inspection.transcodes%ROWTYPE; v storage.objects%ROWTYPE; thumb storage.objects%ROWTYPE; prefix text;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_story_inspection.transcode_config WHERE singleton AND enabled) THEN RETURN false; END IF;
 SELECT * INTO j FROM public.hoop_story_video_jobs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR j.state<>'awaiting_moderation' OR j.inspection_state<>'verified' OR NOT hoopcheck_story_inspection.source_current(j) THEN RETURN false; END IF;
 SELECT * INTO t FROM hoopcheck_story_inspection.transcodes WHERE job_id=p_id AND fence=p_fence AND state='leased' AND lease_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND OR t.source_digest IS DISTINCT FROM j.inspected_sha256 OR p_result->>'source_digest' IS DISTINCT FROM t.source_digest THEN RETURN false; END IF;
 IF p_result->>'state'='rejected' THEN UPDATE hoopcheck_story_inspection.transcodes SET state='rejected' WHERE job_id=p_id;RETURN true; END IF;
 IF p_result->>'state' IS DISTINCT FROM 'ready' OR coalesce(p_result->>'video_sha256','') !~ '^[0-9a-f]{64}$' OR coalesce(p_result->>'thumbnail_sha256','') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid transcode result'; END IF;
 prefix:='story-processed/'||j.owner_id||'/'||j.id||'/'||p_fence||'/';
 SELECT * INTO v FROM storage.objects WHERE bucket_id='hoopfeed-private-videos' AND name=prefix||'video.mp4' AND archived_at IS NULL AND NOT is_delete_marker AND NOT is_versioned AND version IS NOT NULL AND metadata->>'size'=p_result->>'video_size' AND metadata->>'mimetype'='video/mp4';
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO thumb FROM storage.objects WHERE bucket_id='hoopfeed-private-videos' AND name=prefix||'thumbnail.jpg' AND archived_at IS NULL AND NOT is_delete_marker AND NOT is_versioned AND version IS NOT NULL AND metadata->>'size'=p_result->>'thumbnail_size' AND metadata->>'mimetype'='image/jpeg';
 IF NOT FOUND THEN RETURN false; END IF;
 IF (p_result->>'video_size')::bigint NOT BETWEEN 1 AND 52428800 OR (p_result->>'thumbnail_size')::bigint NOT BETWEEN 1 AND 1048576 THEN RETURN false; END IF;
 UPDATE hoopcheck_story_inspection.transcodes SET state='ready',video_id=v.id,video_version=v.version,video_sha256=p_result->>'video_sha256',thumbnail_id=thumb.id,thumbnail_version=thumb.version,thumbnail_sha256=p_result->>'thumbnail_sha256' WHERE job_id=p_id;
 RETURN true;
END $f$;
REVOKE ALL ON FUNCTION public.claim_story_video_transcode(),public.finish_story_video_transcode(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_story_video_transcode(),public.finish_story_video_transcode(uuid,uuid,jsonb) TO service_role;
COMMIT;
