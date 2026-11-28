-- REVIEW ONLY: original-media delivery alongside the existing 27-section
-- durable record export. No migration, provider activation, or hosted writes.
-- An original is deliverable only when its exact storage version is reviewed
-- and approved. Ownerless, archived, versioned and provider-only objects are
-- not inferred or silently substituted.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='30s';
CREATE TABLE hoopcheck_export_private.media_policy(
 singleton boolean PRIMARY KEY CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 max_objects integer CHECK(max_objects BETWEEN 1 AND 10000),
 max_file_bytes bigint CHECK(max_file_bytes BETWEEN 1 AND 20971520),
 CHECK(NOT enabled OR (max_objects IS NOT NULL AND max_file_bytes IS NOT NULL))
);
INSERT INTO hoopcheck_export_private.media_policy(singleton) VALUES(true);
CREATE TABLE hoopcheck_export_private.media_bucket_policy(
 bucket_id text PRIMARY KEY CHECK(bucket_id IN ('fan-group-images','feed-images','feed-videos','hoopfeed-private-images','hoopfeed-private-videos','player-verification-documents','profile-avatars','profile-claim-proofs')),
 enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE hoopcheck_export_private.media_inventory(
 job_id uuid PRIMARY KEY REFERENCES hoopcheck_export_private.jobs(id) ON DELETE CASCADE,
 discovered_count integer NOT NULL CHECK(discovered_count>=0)
);
CREATE TABLE hoopcheck_export_private.media_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 job_id uuid NOT NULL REFERENCES hoopcheck_export_private.media_inventory(job_id) ON DELETE CASCADE,
 object_id uuid NOT NULL,
 bucket_id text NOT NULL,
 object_path text NOT NULL,
 object_version text NOT NULL,
 byte_count bigint NOT NULL CHECK(byte_count BETWEEN 1 AND 20971520),
 decision text NOT NULL DEFAULT 'pending' CHECK(decision IN ('pending','approved','denied')),
 reviewed_at timestamptz,
 CHECK(decision='pending' OR reviewed_at IS NOT NULL),
 UNIQUE(job_id,object_id)
);
CREATE INDEX media_items_job_page ON hoopcheck_export_private.media_items(job_id,id);
ALTER TABLE hoopcheck_export_private.media_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_export_private.media_bucket_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_export_private.media_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_export_private.media_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_export_private.media_policy,hoopcheck_export_private.media_bucket_policy,
 hoopcheck_export_private.media_inventory,hoopcheck_export_private.media_items FROM PUBLIC,anon,authenticated,service_role;

-- Current catalog proof. Both old and new owner fields must not contradict the
-- verified owner. The version must be present and the actual storage object
-- must be a current non-delete-marker object in an explicitly approved bucket.
CREATE FUNCTION hoopcheck_export_private.media_matches(p_owner uuid,p_item hoopcheck_export_private.media_items)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $m$
 SELECT EXISTS(SELECT 1 FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id
 JOIN hoopcheck_export_private.media_bucket_policy bp ON bp.bucket_id=o.bucket_id AND bp.enabled
 WHERE o.id=p_item.object_id AND o.bucket_id=p_item.bucket_id AND o.name=p_item.object_path AND o.version=p_item.object_version
 AND (o.owner_id=p_owner::text OR (o.owner_id IS NULL AND o.owner=p_owner))
 AND (o.owner IS NULL OR o.owner=p_owner) AND o.archived_at IS NULL AND NOT o.is_delete_marker AND NOT o.is_versioned
 AND b.type::text='STANDARD' AND b.versioning_status='DISABLED'
 AND CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,10}$' THEN (o.metadata->>'size')::bigint=p_item.byte_count ELSE false END)
$m$;
REVOKE ALL ON FUNCTION hoopcheck_export_private.media_matches(uuid,hoopcheck_export_private.media_items) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION hoopcheck_export_private.prepare_media_inventory(p_job uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $m$
DECLARE j hoopcheck_export_private.jobs%ROWTYPE; p hoopcheck_export_private.media_policy%ROWTYPE; n integer;
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT p FROM hoopcheck_export_private.media_policy WHERE singleton FOR SHARE;
 IF NOT p.enabled THEN RETURN jsonb_build_object('status','disabled','discovered_count',0); END IF;
 SELECT * INTO j FROM hoopcheck_export_private.jobs WHERE id=p_job AND state='ready' AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM hoopcheck_export_private.policy ep WHERE ep.singleton AND ep.enabled AND ep.scope_version=j.scope_version)
 THEN RAISE EXCEPTION 'Export media unavailable' USING ERRCODE='42501'; END IF;
 SELECT discovered_count INTO n FROM hoopcheck_export_private.media_inventory WHERE job_id=j.id;
 IF FOUND THEN RETURN jsonb_build_object('status','prepared','discovered_count',n); END IF;
 INSERT INTO hoopcheck_export_private.media_inventory VALUES(j.id,0);
 INSERT INTO hoopcheck_export_private.media_items(job_id,object_id,bucket_id,object_path,object_version,byte_count)
 SELECT j.id,o.id,o.bucket_id,o.name,o.version,(o.metadata->>'size')::bigint
 FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id
 JOIN hoopcheck_export_private.media_bucket_policy bp ON bp.bucket_id=o.bucket_id AND bp.enabled
 WHERE (o.owner_id=j.owner_id::text OR (o.owner_id IS NULL AND o.owner=j.owner_id))
 AND (o.owner IS NULL OR o.owner=j.owner_id) AND o.archived_at IS NULL AND NOT o.is_delete_marker AND NOT o.is_versioned
 AND b.type::text='STANDARD' AND b.versioning_status='DISABLED'
 AND o.version IS NOT NULL AND length(o.version) BETWEEN 1 AND 1024
 AND length(o.name) BETWEEN 1 AND 1024 AND position(chr(92) in o.name)=0 AND o.name !~ '[[:cntrl:]]'
 AND NOT EXISTS(SELECT 1 FROM unnest(string_to_array(o.name,'/')) AS segment WHERE segment IN ('','.','..'))
 AND CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,10}$' THEN (o.metadata->>'size')::bigint BETWEEN 1 AND p.max_file_bytes ELSE false END
 ORDER BY o.id LIMIT p.max_objects+1;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n>p.max_objects THEN RAISE EXCEPTION 'Media inventory exceeds approved limit'; END IF;
 UPDATE hoopcheck_export_private.media_inventory SET discovered_count=n WHERE job_id=j.id;
 RETURN jsonb_build_object('status','prepared','discovered_count',n);
END $m$;
REVOKE ALL ON FUNCTION hoopcheck_export_private.prepare_media_inventory(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_export_private.prepare_media_inventory(uuid) TO service_role;
CREATE FUNCTION public.prepare_account_export_media(p_job uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $m$
 SELECT hoopcheck_export_private.prepare_media_inventory(p_job)
$m$;
REVOKE ALL ON FUNCTION public.prepare_account_export_media(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.prepare_account_export_media(uuid) TO service_role;

-- Caller-bound manifest: no raw object ID, path, bucket, version, or private
-- metadata. An approval is per exact stored object version, not per bucket.
CREATE FUNCTION hoopcheck_export_private.owner_media_manifest(p_job uuid,p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $m$
DECLARE uid uuid:=hoopcheck_export_private.verified_owner(); j hoopcheck_export_private.jobs%ROWTYPE;
 p hoopcheck_export_private.media_policy%ROWTYPE; page jsonb; last_id uuid; more boolean;
BEGIN
 SELECT * INTO STRICT p FROM hoopcheck_export_private.media_policy WHERE singleton FOR SHARE;
 SELECT * INTO j FROM hoopcheck_export_private.jobs WHERE id=p_job AND owner_id=uid AND state='ready' AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND OR NOT p.enabled OR NOT EXISTS(SELECT 1 FROM hoopcheck_export_private.policy ep WHERE ep.singleton AND ep.enabled AND ep.scope_version=j.scope_version)
 THEN RAISE EXCEPTION 'Export media unavailable' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM hoopcheck_export_private.media_inventory WHERE job_id=j.id) THEN
  RETURN jsonb_build_object('id',j.id,'complete',false,'state','pending_inventory','items','[]'::jsonb,'next_after',NULL);
 END IF;
 WITH eligible AS (
  SELECT i.id,i.byte_count FROM hoopcheck_export_private.media_items i WHERE i.job_id=j.id
   AND i.decision='approved' AND i.byte_count<=p.max_file_bytes
   AND (p_after IS NULL OR i.id>p_after) AND hoopcheck_export_private.media_matches(uid,i)
   ORDER BY i.id LIMIT 51
 ), first_page AS (SELECT * FROM eligible ORDER BY id LIMIT 50)
 SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'bytes',byte_count) ORDER BY id) FROM first_page),'[]'::jsonb),
  (SELECT id FROM first_page ORDER BY id DESC LIMIT 1),(SELECT count(*)>50 FROM eligible)
 INTO page,last_id,more;
 IF hoopcheck_export_private.verified_owner() IS DISTINCT FROM uid OR j.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'Export media unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('id',j.id,'complete',false,'state','prepared','items',page,'next_after',CASE WHEN more THEN last_id ELSE NULL END,
 'pending_count',(SELECT count(*) FROM hoopcheck_export_private.media_items WHERE job_id=j.id AND decision='pending'),
 'denied_count',(SELECT count(*) FROM hoopcheck_export_private.media_items WHERE job_id=j.id AND decision='denied'));
END $m$;
REVOKE ALL ON FUNCTION hoopcheck_export_private.owner_media_manifest(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_export_private.owner_media_manifest(uuid,uuid) TO authenticated;
CREATE FUNCTION public.account_export_media_manifest(p_job uuid,p_after uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $m$
 SELECT hoopcheck_export_private.owner_media_manifest(p_job,p_after)
$m$;
REVOKE ALL ON FUNCTION public.account_export_media_manifest(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.account_export_media_manifest(uuid,uuid) TO authenticated;

-- Service-only locator. The application must derive p_owner from its verified
-- caller and recheck this same locator after obtaining the private bytes.
CREATE FUNCTION hoopcheck_export_private.resolve_media(p_owner uuid,p_job uuid,p_item uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $m$
DECLARE j hoopcheck_export_private.jobs%ROWTYPE; i hoopcheck_export_private.media_items%ROWTYPE;
 p hoopcheck_export_private.media_policy%ROWTYPE;
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT p FROM hoopcheck_export_private.media_policy WHERE singleton FOR SHARE;
 SELECT * INTO j FROM hoopcheck_export_private.jobs WHERE id=p_job AND owner_id=p_owner AND state='ready' AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND OR NOT p.enabled OR NOT EXISTS(SELECT 1 FROM hoopcheck_export_private.policy ep WHERE ep.singleton AND ep.enabled AND ep.scope_version=j.scope_version)
 THEN RAISE EXCEPTION 'Export media unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM hoopcheck_export_private.media_items WHERE id=p_item AND job_id=j.id AND decision='approved' FOR SHARE;
 IF NOT FOUND OR i.byte_count>p.max_file_bytes OR NOT hoopcheck_export_private.media_matches(p_owner,i)
 THEN RAISE EXCEPTION 'Export media unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('id',i.id,'bucket',i.bucket_id,'path',i.object_path,'version',i.object_version,'object_id',i.object_id,'bytes',i.byte_count,'expires_at',j.expires_at);
END $m$;
REVOKE ALL ON FUNCTION hoopcheck_export_private.resolve_media(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_export_private.resolve_media(uuid,uuid,uuid) TO service_role;
CREATE FUNCTION public.resolve_account_export_media(p_owner uuid,p_job uuid,p_item uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $m$
 SELECT hoopcheck_export_private.resolve_media(p_owner,p_job,p_item)
$m$;
REVOKE ALL ON FUNCTION public.resolve_account_export_media(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.resolve_account_export_media(uuid,uuid,uuid) TO service_role;

-- Reuse the durable job's cancellation/expiration lifecycle. The inventory
-- and every private locator disappear atomically with terminal job state.
CREATE FUNCTION hoopcheck_export_private.scrub_media_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $m$
BEGIN
 IF NEW.state IN ('cancelled','expired','failed') AND OLD.state IS DISTINCT FROM NEW.state THEN
  DELETE FROM hoopcheck_export_private.media_inventory WHERE job_id=NEW.id;
 END IF;
 RETURN NEW;
END $m$;
REVOKE ALL ON FUNCTION hoopcheck_export_private.scrub_media_inventory() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER scrub_export_media AFTER UPDATE OF state ON hoopcheck_export_private.jobs
 FOR EACH ROW EXECUTE FUNCTION hoopcheck_export_private.scrub_media_inventory();
-- Bounded scheduler tick uses the same durable job; no duplicate inventory.
CREATE FUNCTION hoopcheck_export_private.prepare_next_media_inventory()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $m$
DECLARE jid uuid;
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM hoopcheck_export_private.media_policy WHERE singleton AND enabled)
 OR NOT EXISTS(SELECT 1 FROM hoopcheck_export_private.policy WHERE singleton AND enabled)
 THEN RETURN jsonb_build_object('status','disabled','discovered_count',0); END IF;
 SELECT j.id INTO jid FROM hoopcheck_export_private.jobs j WHERE j.state='ready' AND j.expires_at>clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM hoopcheck_export_private.media_inventory i WHERE i.job_id=j.id)
 ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','idle','discovered_count',0); END IF;
 RETURN hoopcheck_export_private.prepare_media_inventory(jid);
END $m$;
REVOKE ALL ON FUNCTION hoopcheck_export_private.prepare_next_media_inventory() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_export_private.prepare_next_media_inventory() TO service_role;
CREATE FUNCTION public.prepare_next_account_export_media() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $m$
 SELECT hoopcheck_export_private.prepare_next_media_inventory()
$m$;
REVOKE ALL ON FUNCTION public.prepare_next_account_export_media() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.prepare_next_account_export_media() TO service_role;

COMMIT;
