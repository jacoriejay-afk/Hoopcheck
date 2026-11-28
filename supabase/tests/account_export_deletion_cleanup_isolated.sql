-- Synthetic supplement, after existing export + media fixtures.
\set ON_ERROR_STOP on
CREATE SCHEMA hoopcheck_deletion_private;
GRANT USAGE ON SCHEMA hoopcheck_deletion_private TO service_role;
CREATE TABLE public.account_deletion_requests(id uuid PRIMARY KEY,user_id uuid NOT NULL);
CREATE TABLE hoopcheck_deletion_private.worker_state(request_id uuid PRIMARY KEY,policy_version text,next_step integer,fence uuid);
CREATE TABLE hoopcheck_deletion_private.frozen_accounts(request_id uuid PRIMARY KEY,owner_id uuid);
CREATE FUNCTION public.assert_account_deletion_worker(p_request uuid,p_owner uuid,p_fence uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT FROM public.account_deletion_requests r JOIN hoopcheck_deletion_private.worker_state w ON w.request_id=r.id WHERE r.id=p_request AND r.user_id=p_owner AND w.fence=p_fence AND w.next_step=8)
$$;
\ir ../candidates/appstore_deletion_export_cleanup_review_only.sql
INSERT INTO public.account_deletion_requests VALUES('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111');
INSERT INTO hoopcheck_deletion_private.worker_state VALUES('99999999-9999-4999-8999-999999999999','fixture',8,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO hoopcheck_deletion_private.frozen_accounts VALUES('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111');
INSERT INTO hoopcheck_export_private.jobs(id,owner_id,scope_version,state,expires_at,row_count) VALUES('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','owned-records-v1','ready',now()+interval '1 hour',1),('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','owned-records-v1','ready',now()+interval '1 hour',1);
INSERT INTO hoopcheck_export_private.records VALUES('77777777-7777-4777-8777-777777777777',1,'profile','{"id":"owner"}'),('88888888-8888-4888-8888-888888888888',1,'profile','{"id":"other"}');
INSERT INTO hoopcheck_export_private.events(job_id,event) VALUES('77777777-7777-4777-8777-777777777777','ready'),('88888888-8888-4888-8888-888888888888','ready');
INSERT INTO hoopcheck_export_private.media_inventory VALUES('77777777-7777-4777-8777-777777777777',1);
INSERT INTO hoopcheck_export_private.media_items(job_id,object_id,bucket_id,object_path,object_version,byte_count)
 VALUES('77777777-7777-4777-8777-777777777777',gen_random_uuid(),'feed-images','fixture/approved.jpg','v1',4);
SET ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
DO $$BEGIN
 BEGIN PERFORM public.scrub_approved_deletion_exports('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); RAISE EXCEPTION 'unapproved cleanup accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.scrub_approved_deletion_exports('99999999-9999-4999-8999-999999999999','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); RAISE EXCEPTION 'other owner cleanup accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
INSERT INTO hoopcheck_deletion_private.export_cleanup_approvals VALUES('99999999-9999-4999-8999-999999999999','fixture',false);
SET ROLE service_role;
DO $$BEGIN
 BEGIN PERFORM public.scrub_approved_deletion_exports('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); RAISE EXCEPTION 'held cleanup accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END$$;
RESET ROLE;
UPDATE hoopcheck_deletion_private.export_cleanup_approvals SET legal_hold_cleared=true;
SET ROLE service_role;
DO $$DECLARE v jsonb;BEGIN
 v:=public.scrub_approved_deletion_exports('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 IF v->>'ok'<>'true' OR (v->>'removed_jobs')::int<1 OR public.scrub_approved_deletion_exports('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') IS DISTINCT FROM v THEN RAISE EXCEPTION 'cleanup receipt or retry failed'; END IF;
END$$;
RESET ROLE;
DO $$BEGIN
 IF EXISTS(SELECT FROM hoopcheck_export_private.jobs WHERE owner_id='11111111-1111-4111-8111-111111111111')
 OR EXISTS(SELECT FROM hoopcheck_export_private.records WHERE job_id='77777777-7777-4777-8777-777777777777')
 OR EXISTS(SELECT FROM hoopcheck_export_private.media_items WHERE job_id='77777777-7777-4777-8777-777777777777')
 OR EXISTS(SELECT FROM hoopcheck_export_private.events WHERE job_id='77777777-7777-4777-8777-777777777777')
 OR NOT EXISTS(SELECT FROM hoopcheck_export_private.jobs WHERE id='88888888-8888-4888-8888-888888888888')
 OR NOT EXISTS(SELECT FROM hoopcheck_export_private.records WHERE job_id='88888888-8888-4888-8888-888888888888')
 OR NOT EXISTS(SELECT FROM hoopcheck_export_private.events WHERE job_id='88888888-8888-4888-8888-888888888888')
 THEN RAISE EXCEPTION 'export cleanup scope incorrect'; END IF;
END$$;
\echo PASS: derived export copies and private locators scrubbed with approved frozen lease, other account preserved, idempotent receipt
