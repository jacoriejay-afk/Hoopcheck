\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA storage;CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean NOT NULL);
INSERT INTO storage.buckets VALUES('hoopfeed-private-videos',false);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb,version text,archived_at timestamptz,is_delete_marker boolean NOT NULL DEFAULT false,is_versioned boolean NOT NULL DEFAULT false);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated,anon;
GRANT SELECT,INSERT ON storage.objects TO authenticated,anon;
CREATE POLICY fixture_all ON storage.objects FOR ALL TO authenticated,anon USING(true) WITH CHECK(true);
\ir ../candidates/hoop_story_video_jobs_review_only.sql
\ir ../candidates/hoop_story_video_inspection_review_only.sql
INSERT INTO auth.users VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO public.hoop_story_video_jobs(id,owner_id,object_path,content_type,size_bytes,declared_duration_ms,state,uploaded_at)
 VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','story-quarantine/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.mp4','video/mp4',3,1000,'awaiting_moderation',now());
INSERT INTO storage.objects(bucket_id,name,metadata,version) SELECT 'hoopfeed-private-videos',object_path,jsonb_build_object('size',size_bytes,'mimetype',content_type),'v1' FROM public.hoop_story_video_jobs;
SET request.jwt.claims='{"role":"service_role"}';
DO $$ BEGIN IF public.claim_story_video_inspection()->>'state'<>'disabled' THEN RAISE EXCEPTION 'Default off bypass'; END IF; END $$;
SET ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT FROM storage.objects) THEN RAISE EXCEPTION 'Quarantine read bypass'; END IF;
 BEGIN PERFORM public.claim_story_video_inspection();RAISE EXCEPTION 'Client claimed inspection';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
UPDATE hoopcheck_story_inspection.config SET enabled=true;
DO $f$ DECLARE lease jsonb; result jsonb; job uuid; fence uuid; BEGIN
 lease:=public.claim_story_video_inspection();job:=(lease->>'id')::uuid;fence:=(lease->>'fence')::uuid;
 IF lease->>'state'<>'leased' OR public.claim_story_video_inspection()->>'state'<>'idle' THEN RAISE EXCEPTION 'Duplicate lease'; END IF;
 result:=jsonb_build_object('state','verified','sha256',repeat('a',64),'duration_ms',1000,'width',160,'height',90,'audio',true);
 IF public.finish_story_video_inspection(job,gen_random_uuid(),result) THEN RAISE EXCEPTION 'Stale lease accepted'; END IF;
 UPDATE storage.objects SET version='v2';
 IF public.finish_story_video_inspection(job,fence,result) THEN RAISE EXCEPTION 'Changed object accepted'; END IF;
 UPDATE public.hoop_story_video_jobs SET inspection_until=now()-interval '1 second' WHERE id=job;
 lease:=public.claim_story_video_inspection();
 IF lease->>'version'<>'v2' OR NOT public.finish_story_video_inspection(job,(lease->>'fence')::uuid,result) THEN RAISE EXCEPTION 'Retry failed'; END IF;
 IF NOT EXISTS(SELECT FROM public.hoop_story_video_jobs WHERE id=job AND inspection_state='verified' AND state='awaiting_moderation' AND inspected_sha256=repeat('a',64)) THEN RAISE EXCEPTION 'Inspection not recorded'; END IF;
END $f$;
SELECT 'PASS synthetic private quarantine access and inspection fencing';

\ir ../candidates/hoop_story_video_transcode_review_only.sql
DO $$BEGIN IF public.claim_story_video_transcode()->>'state'<>'disabled' THEN RAISE EXCEPTION 'Default-off bypass';END IF;END$$;
UPDATE hoopcheck_story_inspection.transcode_config SET enabled=true;
DO $f$ DECLARE l jsonb; x jsonb; j uuid; f uuid; BEGIN
 l:=public.claim_story_video_transcode();j:=(l->>'id')::uuid;f:=(l->>'fence')::uuid;
 IF l->>'state'<>'leased' OR public.claim_story_video_transcode()->>'state'<>'idle' THEN RAISE EXCEPTION 'Duplicate transcode lease';END IF;
 x:=jsonb_build_object('state','ready','source_digest',repeat('a',64),'video_size',3,'video_sha256',repeat('b',64),'thumbnail_size',4,'thumbnail_sha256',repeat('c',64));
 IF public.finish_story_video_transcode(j,f,x) THEN RAISE EXCEPTION 'Missing outputs accepted';END IF;
 INSERT INTO storage.objects(bucket_id,name,metadata,version) VALUES
 ('hoopfeed-private-videos',l->>'video_path','{"size":3,"mimetype":"video/mp4"}','video-v1'),
 ('hoopfeed-private-videos',l->>'thumbnail_path','{"size":4,"mimetype":"image/jpeg"}','thumb-v1');
 IF public.finish_story_video_transcode(j,gen_random_uuid(),x) THEN RAISE EXCEPTION 'Stale fence accepted';END IF;
 IF NOT public.finish_story_video_transcode(j,f,x) THEN RAISE EXCEPTION 'Technical output not recorded';END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_story_inspection.transcodes WHERE job_id=j AND state='ready') OR NOT EXISTS(SELECT FROM public.hoop_story_video_jobs WHERE id=j AND state='awaiting_moderation') THEN RAISE EXCEPTION 'Transcode approved content';END IF;
END $f$;
SET ROLE authenticated;
DO $$BEGIN IF EXISTS(SELECT FROM storage.objects) THEN RAISE EXCEPTION 'Processed bytes visible';END IF;END$$;
RESET ROLE;
SELECT 'PASS private transcode lifecycle and thumbnail receipt, no moderation bypass';

CREATE TABLE public.admin_roles(user_id uuid,role text);
INSERT INTO auth.users VALUES('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
INSERT INTO public.admin_roles VALUES('33333333-3333-4333-8333-333333333333','moderator');
\ir ../candidates/hoop_story_video_review_lifecycle_review_only.sql
DO $f$ DECLARE owner uuid:='11111111-1111-4111-8111-111111111111';job uuid:='22222222-2222-4222-8222-222222222222';actor uuid:='33333333-3333-4333-8333-333333333333';other uuid:='44444444-4444-4444-8444-444444444444';a jsonb;f uuid; BEGIN
 IF public.story_video_owner_status(owner,job)->>'phase' IS DISTINCT FROM 'awaiting_review' OR public.story_video_owner_status(other,job) IS NOT NULL THEN RAISE EXCEPTION 'Status scope';END IF;
 IF public.story_video_review_asset(actor,job) IS NOT NULL THEN RAISE EXCEPTION 'Default-off review bypass';END IF;
 UPDATE hoopcheck_story_inspection.review_config SET enabled=true;
 IF jsonb_array_length(public.story_video_owner_jobs(owner)->'jobs')<>1 OR jsonb_array_length(public.story_video_owner_jobs(other)->'jobs')<>0 OR public.story_video_owner_jobs(owner)::text LIKE '%story-processed%' THEN RAISE EXCEPTION 'Owner recovery scope';END IF;
 IF jsonb_array_length(public.story_video_review_queue(actor)->'jobs')<>1 OR public.story_video_review_queue(other) IS NOT NULL THEN RAISE EXCEPTION 'Queue scope';END IF;
 a:=public.story_video_review_asset(actor,job);f:=(a->>'fence')::uuid;
 IF f IS NULL OR public.story_video_review_asset(other,job) IS NOT NULL THEN RAISE EXCEPTION 'Reviewer scope';END IF;
 IF public.record_story_video_review(actor,job,f,repeat('b',64),repeat('c',64),'approved','no_audio') THEN RAISE EXCEPTION 'Audio bypass';END IF;
 IF public.record_story_video_review(actor,job,f,repeat('a',64),repeat('c',64),'approved','approved') THEN RAISE EXCEPTION 'Wrong digest accepted';END IF;
 IF NOT public.record_story_video_review(actor,job,f,repeat('b',64),repeat('c',64),'approved','approved') THEN RAISE EXCEPTION 'Explicit review failed';END IF;
 IF NOT public.record_story_video_review(actor,job,f,repeat('b',64),repeat('c',64),'approved','approved') THEN RAISE EXCEPTION 'Review replay not idempotent';END IF;
 IF public.record_story_video_review(actor,job,f,repeat('b',64),repeat('c',64),'rejected','approved') THEN RAISE EXCEPTION 'Review mutable';END IF;
 IF public.story_video_owner_status(owner,job)->>'phase' IS DISTINCT FROM 'review_approved' OR (public.story_video_owner_status(owner,job)->>'published')::boolean THEN RAISE EXCEPTION 'Review erroneously publishes';END IF;
 IF jsonb_array_length(public.story_video_review_queue(actor)->'jobs')<>0 THEN RAISE EXCEPTION 'Resolved review queued';END IF;
 IF public.revoke_story_video_review(other,job,f) THEN RAISE EXCEPTION 'Unauthorized revocation';END IF;
 IF NOT public.revoke_story_video_review(actor,job,f) THEN RAISE EXCEPTION 'Review revocation failed';END IF;
 IF public.story_video_owner_status(owner,job)->>'phase' IS DISTINCT FROM 'rejected' THEN RAISE EXCEPTION 'Revoked review still approved';END IF;
 UPDATE storage.objects SET version='changed' WHERE name LIKE '%/video.mp4' AND name LIKE 'story-processed/%';
 IF public.story_video_review_asset(actor,job) IS NOT NULL OR public.story_video_owner_status(owner,job)->>'phase' IS DISTINCT FROM 'retry_required' THEN RAISE EXCEPTION 'Changed output still approved';END IF;
END $f$;
SELECT 'PASS explicit asset-bound human visual/audio review, owner-only status and fail-closed publication';

-- Supplemental owner recovery, queue and revocation contract.
DO $$BEGIN
 IF has_function_privilege('authenticated','public.story_video_owner_jobs(uuid)','EXECUTE') OR has_function_privilege('authenticated','public.story_video_review_queue(uuid)','EXECUTE') OR has_function_privilege('authenticated','public.revoke_story_video_review(uuid,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Private review service function exposed';END IF;
END$$;

-- Explicit synthetic publication fixture; never sourced by actual acceptance.
CREATE SCHEMA private;CREATE SCHEMA hoopcheck_security;
GRANT USAGE ON SCHEMA auth,private,hoopcheck_security TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
CREATE FUNCTION public.confirm_active_account_session() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('fixture.active',true)='yes'$$;
CREATE FUNCTION hoopcheck_security.mfa_satisfied() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('fixture.mfa',true)='yes'$$;
CREATE FUNCTION public.can_use_unified_hoopfeed() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('fixture.paid',true)='yes'$$;
CREATE FUNCTION private.hoopfeed_can_read_author(p_author uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT auth.uid()=p_author OR current_setting('fixture.following',true)='yes'$$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,moderation_status text);
INSERT INTO public.profiles VALUES('11111111-1111-4111-8111-111111111111','normal'),('44444444-4444-4444-8444-444444444444','normal');
CREATE TABLE public.feed_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),author_id uuid,body text,status text,post_kind text,community_visible boolean,created_at timestamptz,expires_at timestamptz,video_url text,image_url text,image_urls jsonb,shared_post_id uuid);
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unified hoopfeed approved posts read" ON public.feed_posts FOR SELECT TO authenticated USING(status='approved' AND expires_at>now() AND private.hoopfeed_can_read_author(author_id) AND public.can_use_unified_hoopfeed());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.feed_posts TO authenticated;
CREATE POLICY fixture_insert ON public.feed_posts FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid());
CREATE POLICY fixture_update ON public.feed_posts FOR UPDATE TO authenticated USING(author_id=auth.uid()) WITH CHECK(author_id=auth.uid());
CREATE POLICY fixture_delete ON public.feed_posts FOR DELETE TO authenticated USING(author_id=auth.uid());
\ir ../candidates/hoop_story_video_publication_review_only.sql
-- Reset only synthetic asset catalog and explicit test decision before publish.
UPDATE storage.objects SET version='video-v1' WHERE name LIKE 'story-processed/%/video.mp4';
UPDATE hoopcheck_story_inspection.reviews SET revoked_at=NULL;
SET fixture.active='yes';SET fixture.mfa='yes';SET fixture.paid='yes';SET fixture.following='no';
SET ROLE authenticated;
SET request.jwt.claims='{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}';
DO $$BEGIN IF public.publish_reviewed_story_video('22222222-2222-4222-8222-222222222222')->>'state' IS DISTINCT FROM 'disabled' THEN RAISE EXCEPTION 'Default-off publication bypass';END IF;END$$;
RESET ROLE;
UPDATE hoopcheck_story_inspection.publication_config SET enabled=true;
UPDATE hoopcheck_story_inspection.reviews SET revoked_at=now();
SET ROLE authenticated;
DO $$BEGIN IF public.publish_reviewed_story_video('22222222-2222-4222-8222-222222222222')->>'state' IS DISTINCT FROM 'unavailable' THEN RAISE EXCEPTION 'Revoked publication accepted';END IF;END$$;
RESET ROLE;
UPDATE hoopcheck_story_inspection.reviews SET revoked_at=NULL;
SET ROLE authenticated;
DO $f$ DECLARE x jsonb;y jsonb; BEGIN
 x:=public.publish_reviewed_story_video('22222222-2222-4222-8222-222222222222');
 IF x->>'state' IS DISTINCT FROM 'published' THEN RAISE EXCEPTION 'Approved publication missing';END IF;
 y:=public.publish_reviewed_story_video('22222222-2222-4222-8222-222222222222');
 IF x IS DISTINCT FROM y OR (SELECT count(*) FROM public.feed_posts)<>1 THEN RAISE EXCEPTION 'Duplicate publication';END IF;
 BEGIN UPDATE public.feed_posts SET community_visible=true;RAISE EXCEPTION 'Audience mutation accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $f$;
SET request.jwt.claims='{"role":"authenticated","sub":"44444444-4444-4444-8444-444444444444"}';
DO $$BEGIN IF EXISTS(SELECT FROM public.feed_posts) THEN RAISE EXCEPTION 'Non-follower sees Story';END IF;IF public.publish_reviewed_story_video('22222222-2222-4222-8222-222222222222')->>'state' IS DISTINCT FROM 'unavailable' THEN RAISE EXCEPTION 'Foreign job published';END IF;END$$;
SET fixture.following='yes';
DO $$BEGIN IF (SELECT count(*) FROM public.feed_posts)<>1 THEN RAISE EXCEPTION 'Follower playback scope missing';END IF;END$$;
SET fixture.mfa='no';
DO $$BEGIN IF EXISTS(SELECT FROM public.feed_posts) THEN RAISE EXCEPTION 'AAL denied viewer sees video';END IF;END$$;
RESET ROLE;
SET fixture.mfa='yes';
SET request.jwt.claims='{"role":"service_role"}';
DO $$BEGIN IF NOT EXISTS(SELECT FROM public.feed_posts f WHERE public.resolve_reviewed_story_video(f.id,f.video_url) IS NOT NULL) THEN RAISE EXCEPTION 'Approved asset not resolved';END IF;END$$;
UPDATE hoopcheck_story_inspection.reviews SET revoked_at=now();
DO $$BEGIN IF EXISTS(SELECT FROM public.feed_posts f WHERE public.resolve_reviewed_story_video(f.id,f.video_url) IS NOT NULL) THEN RAISE EXCEPTION 'Revoked asset resolved';END IF;END$$;
SELECT 'PASS reviewed video publication receipt, audience, MFA, mutation protection and revocation';
