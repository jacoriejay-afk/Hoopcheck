-- Review only; depends on hoop_story_video_jobs_review_only.sql. No rollout.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='20s';
DO $guard$ BEGIN
 IF to_regclass('public.hoop_story_video_jobs') IS NULL OR NOT EXISTS(SELECT FROM storage.buckets WHERE id='hoopfeed-private-videos' AND public=false)
 OR NOT EXISTS(SELECT FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Private video staging prerequisites missing'; END IF;
END $guard$;
-- Direct authenticated access is never allowed for quarantine bytes. The
-- signed, exact-path upload issued by the staging route is separate.
CREATE POLICY story_quarantine_no_client_objects ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING (NOT (bucket_id='hoopfeed-private-videos' AND name LIKE 'story-quarantine/%'))
 WITH CHECK (NOT (bucket_id='hoopfeed-private-videos' AND name LIKE 'story-quarantine/%'));
CREATE SCHEMA hoopcheck_story_inspection;
REVOKE ALL ON SCHEMA hoopcheck_story_inspection FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE hoopcheck_story_inspection.config(singleton boolean PRIMARY KEY CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO hoopcheck_story_inspection.config VALUES(true,false);
ALTER TABLE public.hoop_story_video_jobs ADD COLUMN inspection_state text NOT NULL DEFAULT 'pending' CHECK(inspection_state IN ('pending','leased','verified','rejected'));
ALTER TABLE public.hoop_story_video_jobs ADD COLUMN inspection_fence uuid, ADD COLUMN inspection_until timestamptz,
 ADD COLUMN inspected_object uuid,ADD COLUMN inspected_version text,ADD COLUMN inspected_sha256 text CHECK(inspected_sha256 ~ '^[0-9a-f]{64}$'),
 ADD COLUMN inspected_duration_ms integer CHECK(inspected_duration_ms BETWEEN 1 AND 60000),
 ADD COLUMN inspected_width integer CHECK(inspected_width BETWEEN 1 AND 1920),
 ADD COLUMN inspected_height integer CHECK(inspected_height BETWEEN 1 AND 1920),
 ADD COLUMN inspected_audio boolean,ADD COLUMN inspection_attempts integer NOT NULL DEFAULT 0 CHECK(inspection_attempts BETWEEN 0 AND 5);
ALTER TABLE public.hoop_story_video_jobs ADD CONSTRAINT story_inspection_fence_check CHECK((inspection_state='leased')=(inspection_fence IS NOT NULL AND inspection_until IS NOT NULL));
ALTER TABLE public.hoop_story_video_jobs ADD CONSTRAINT story_inspection_verified_check CHECK(inspection_state<>'verified' OR (inspected_object IS NOT NULL AND inspected_version IS NOT NULL AND inspected_sha256 IS NOT NULL AND inspected_duration_ms IS NOT NULL AND inspected_width IS NOT NULL AND inspected_height IS NOT NULL AND inspected_audio IS NOT NULL));
ALTER TABLE hoopcheck_story_inspection.config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_story_inspection.config FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX story_video_inspection_pending ON public.hoop_story_video_jobs(inspection_state,created_at,id) WHERE state='awaiting_moderation';
CREATE FUNCTION public.claim_story_video_inspection() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE j public.hoop_story_video_jobs%ROWTYPE; o storage.objects%ROWTYPE; fence uuid:=gen_random_uuid();
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_story_inspection.config WHERE singleton AND enabled) THEN RETURN jsonb_build_object('state','disabled'); END IF;
 SELECT x.* INTO j FROM public.hoop_story_video_jobs x
 WHERE x.state='awaiting_moderation' AND x.inspection_attempts<5 AND (x.inspection_state='pending' OR (x.inspection_state='leased' AND x.inspection_until<clock_timestamp()))
 AND EXISTS(SELECT FROM storage.objects s JOIN storage.buckets b ON b.id=s.bucket_id WHERE s.bucket_id='hoopfeed-private-videos' AND b.public=false AND s.name=x.object_path AND s.archived_at IS NULL AND NOT s.is_delete_marker AND NOT s.is_versioned AND s.version IS NOT NULL AND s.metadata->>'size'=x.size_bytes::text AND s.metadata->>'mimetype'=x.content_type)
 ORDER BY x.created_at,x.id LIMIT 1 FOR UPDATE OF x SKIP LOCKED;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','idle'); END IF;
 SELECT s.* INTO STRICT o FROM storage.objects s WHERE s.bucket_id='hoopfeed-private-videos' AND s.name=j.object_path AND s.archived_at IS NULL AND NOT s.is_delete_marker AND NOT s.is_versioned AND s.version IS NOT NULL AND s.metadata->>'size'=j.size_bytes::text AND s.metadata->>'mimetype'=j.content_type;
 UPDATE public.hoop_story_video_jobs SET inspection_state='leased',inspection_fence=fence,inspection_until=clock_timestamp()+interval '5 minutes',inspection_attempts=inspection_attempts+1,inspected_object=o.id,inspected_version=o.version WHERE id=j.id;
 RETURN jsonb_build_object('state','leased','id',j.id,'owner_id',j.owner_id,'object_path',j.object_path,'content_type',j.content_type,'size_bytes',j.size_bytes,'declared_duration_ms',j.declared_duration_ms,'fence',fence,'object_id',o.id,'version',o.version);
END $f$;
CREATE FUNCTION public.finish_story_video_inspection(p_id uuid,p_fence uuid,p_result jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE j public.hoop_story_video_jobs%ROWTYPE; kind text;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_story_inspection.config WHERE singleton AND enabled) THEN RETURN false; END IF;
 SELECT * INTO j FROM public.hoop_story_video_jobs WHERE id=p_id AND inspection_state='leased' AND inspection_fence=p_fence AND inspection_until>clock_timestamp() AND state='awaiting_moderation' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT FROM storage.objects s JOIN storage.buckets b ON b.id=s.bucket_id WHERE s.id=j.inspected_object AND s.version=j.inspected_version AND s.name=j.object_path AND s.bucket_id='hoopfeed-private-videos' AND b.public=false AND s.archived_at IS NULL AND NOT s.is_delete_marker AND NOT s.is_versioned AND s.metadata->>'size'=j.size_bytes::text AND s.metadata->>'mimetype'=j.content_type) THEN RETURN false; END IF;
 kind:=p_result->>'state';
 IF kind='verified' THEN
  IF jsonb_typeof(p_result->'audio') IS DISTINCT FROM 'boolean' OR p_result->>'sha256' IS NULL OR p_result->>'sha256' !~ '^[0-9a-f]{64}$' OR p_result->>'duration_ms' IS NULL OR p_result->>'width' IS NULL OR p_result->>'height' IS NULL THEN RAISE EXCEPTION 'Invalid inspection result'; END IF;
  UPDATE public.hoop_story_video_jobs SET inspection_state='verified',inspection_fence=NULL,inspection_until=NULL,inspected_sha256=p_result->>'sha256',inspected_duration_ms=(p_result->>'duration_ms')::integer,inspected_width=(p_result->>'width')::integer,inspected_height=(p_result->>'height')::integer,inspected_audio=(p_result->>'audio')::boolean WHERE id=j.id;
 ELSIF kind='rejected' THEN
  UPDATE public.hoop_story_video_jobs SET inspection_state='rejected',inspection_fence=NULL,inspection_until=NULL WHERE id=j.id;
 ELSE RAISE EXCEPTION 'Invalid inspection state'; END IF;
 -- Technical verification is not moderation approval. Both original job
 -- states remain unchanged and public signing/publication are still denied.
 RETURN true;
END $f$;
REVOKE ALL ON FUNCTION public.claim_story_video_inspection(),public.finish_story_video_inspection(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_story_video_inspection(),public.finish_story_video_inspection(uuid,uuid,jsonb) TO service_role;
COMMIT;
