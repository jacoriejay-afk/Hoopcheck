-- Run after the existing export lifecycle fixture in the same disposable PG17 DB.
\set ON_ERROR_STOP on
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,type text NOT NULL,versioning_status text NOT NULL);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,version text,metadata jsonb,archived_at timestamptz,is_delete_marker boolean NOT NULL DEFAULT false,is_versioned boolean NOT NULL DEFAULT false);
INSERT INTO storage.buckets VALUES('feed-images','STANDARD','DISABLED'),('feed-videos','STANDARD','DISABLED'),('profile-avatars','STANDARD','ENABLED');
INSERT INTO storage.objects(id,bucket_id,name,owner,owner_id,version,metadata) VALUES
 ('66666666-6666-4666-8666-666666666666','feed-images','owner/original.jpg','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','v1','{"size":4}'),
 (gen_random_uuid(),'feed-images','owner/second.jpg','11111111-1111-4111-8111-111111111111',NULL,'v2','{"size":8}'),
 (gen_random_uuid(),'feed-images','other/private.jpg','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','v3','{"size":4}'),
 (gen_random_uuid(),'feed-images','contradictory/private.jpg','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','v4','{"size":4}'),
 (gen_random_uuid(),'feed-images','owner/../traversal.jpg','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','v5','{"size":4}'),
 (gen_random_uuid(),'feed-videos','owner/not-approved.mp4','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','v6','{"size":4}'),
 (gen_random_uuid(),'profile-avatars','owner/versioned.jpg','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','v7','{"size":4}');
\ir ../candidates/account_export_media_review_only.sql
UPDATE hoopcheck_export_private.policy SET enabled=true;
INSERT INTO hoopcheck_export_private.jobs(id,owner_id,scope_version,state,expires_at) VALUES('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','owned-records-v1','ready',now()+interval '1 hour');
SET ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
DO $$BEGIN
 IF public.prepare_next_account_export_media()->>'status'<>'disabled' THEN RAISE EXCEPTION 'disabled worker ran'; END IF;
END$$;
RESET ROLE;
UPDATE hoopcheck_export_private.media_policy SET enabled=true,max_objects=10,max_file_bytes=100;
INSERT INTO hoopcheck_export_private.media_bucket_policy VALUES('feed-images',true),('profile-avatars',true);
SET ROLE service_role;
DO $$BEGIN
 IF public.prepare_next_account_export_media() IS DISTINCT FROM '{"status":"prepared","discovered_count":2}'::jsonb THEN RAISE EXCEPTION 'inventory scope incorrect'; END IF;
 IF public.prepare_next_account_export_media()->>'status'<>'idle' THEN RAISE EXCEPTION 'duplicate inventory'; END IF;
END$$;
RESET ROLE;
SELECT id AS item FROM hoopcheck_export_private.media_items WHERE object_id='66666666-6666-4666-8666-666666666666' \gset
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_active":"true","mfa":"true"}',false);
DO $$BEGIN
 IF jsonb_array_length(public.account_export_media_manifest('55555555-5555-4555-8555-555555555555')->'items')<>0 THEN RAISE EXCEPTION 'pending items disclosed'; END IF;
 BEGIN PERFORM * FROM hoopcheck_export_private.media_items; RAISE EXCEPTION 'private locators exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.resolve_account_export_media('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',gen_random_uuid()); RAISE EXCEPTION 'caller resolver exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
UPDATE hoopcheck_export_private.media_items SET decision='approved',reviewed_at=now() WHERE object_id='66666666-6666-4666-8666-666666666666';
SET ROLE authenticated;
DO $$DECLARE m jsonb;BEGIN
 m:=public.account_export_media_manifest('55555555-5555-4555-8555-555555555555');
 IF jsonb_array_length(m->'items')<>1 OR (m->>'pending_count')::int<>1 OR m->>'complete'<>'false'
 OR m::text LIKE '%owner/original.jpg%' OR m::text LIKE '%object_id%' OR m::text LIKE '%bucket%' THEN RAISE EXCEPTION 'manifest disclosed locator'; END IF;
END$$;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","session_active":"true","mfa":"true"}',false);
DO $$BEGIN
 BEGIN PERFORM public.account_export_media_manifest('55555555-5555-4555-8555-555555555555'); RAISE EXCEPTION 'foreign manifest'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
SELECT public.resolve_account_export_media('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',:'item') AS approved_locator \gset
RESET ROLE;
DO $$BEGIN
 IF NOT EXISTS(SELECT FROM hoopcheck_export_private.media_items WHERE object_id='66666666-6666-4666-8666-666666666666' AND decision='approved') THEN RAISE EXCEPTION 'missing approved source'; END IF;
END$$;
UPDATE storage.objects SET version='changed' WHERE id='66666666-6666-4666-8666-666666666666';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_active":"true","mfa":"true"}',false);
DO $$BEGIN
 IF jsonb_array_length(public.account_export_media_manifest('55555555-5555-4555-8555-555555555555')->'items')<>0 THEN RAISE EXCEPTION 'changed object disclosed'; END IF;
END$$;
SELECT public.account_export_job('cancel','55555555-5555-4555-8555-555555555555');
RESET ROLE;
DO $$BEGIN
 IF EXISTS(SELECT FROM hoopcheck_export_private.media_items WHERE job_id='55555555-5555-4555-8555-555555555555') OR EXISTS(SELECT FROM hoopcheck_export_private.media_inventory WHERE job_id='55555555-5555-4555-8555-555555555555') THEN RAISE EXCEPTION 'cancel did not scrub private locators'; END IF;
END$$;
\echo PASS: original media synthetic ownership, per-object approval, version drift and cancellation
