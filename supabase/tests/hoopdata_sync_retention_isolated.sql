\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'hoopcheck_hoopdata_budget_test' THEN RAISE EXCEPTION 'Disposable fixture database required'; END IF; END $$;
\ir ../candidates/hoopdata_sync_retention_review_only.sql
DO $$ BEGIN
 IF has_function_privilege('anon','public.hoopdata_purge_expired_competition_snapshots()','EXECUTE') OR
 has_function_privilege('authenticated','public.hoopdata_stage_leased_competition_snapshot(uuid,text,uuid,bigint,text,text,timestamptz,jsonb,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'Licensed snapshot access too broad'; END IF;
END $$;
UPDATE public.hoopdata_competition_refresh_jobs SET next_due_at=now()-interval '1 minute';
SET ROLE service_role;
DO $licensed_stage$ DECLARE
 l uuid:='33333333-3333-4333-8333-333333333333'; token uuid; t timestamptz; j jsonb; payload jsonb:='[{"season":"2026-2027","start":"2026-10-01","end":"2027-06-01","games":true,"standings":true}]';
BEGIN
 j:=public.hoopdata_claim_competition_refresh(); token:=(j->>'leaseToken')::uuid;t:=clock_timestamp();
 IF token IS NULL THEN RAISE EXCEPTION 'Missing lease'; END IF;
 IF public.hoopdata_stage_leased_competition_snapshot(l,'seasons',gen_random_uuid(),12,'mens','',t,payload,t+interval '48 hours') OR
 public.hoopdata_stage_leased_competition_snapshot(l,'seasons',token,12,'mens','',t,payload,t+interval '49 hours') THEN RAISE EXCEPTION 'Invalid retention or lease accepted'; END IF;
 IF NOT public.hoopdata_stage_leased_competition_snapshot(l,'seasons',token,12,'mens','',t,payload,t+interval '48 hours') THEN RAISE EXCEPTION 'Authorized retained snapshot refused'; END IF;
 IF public.hoopdata_stage_competition_snapshot(l,12,'mens','seasons','',clock_timestamp(),payload) THEN RAISE EXCEPTION 'Legacy route overwrote managed retention'; END IF;
 IF NOT public.hoopdata_finish_competition_refresh(l,'seasons',token,'staged',NULL) THEN RAISE EXCEPTION 'Lease completion failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.hoopdata_competition_snapshots WHERE league_id=l AND kind='seasons' AND retention_expires_at=t+interval '48 hours') THEN RAISE EXCEPTION 'Retention not persisted'; END IF;
END $licensed_stage$;
RESET ROLE;
UPDATE public.hoopdata_competition_snapshots SET retention_expires_at=now()-interval '1 minute' WHERE kind='seasons';
UPDATE public.hoopdata_standings_attestations SET retention_expires_at=now()-interval '1 minute' WHERE season='2026-2027';
SET ROLE service_role;
DO $cleanup$ BEGIN
 IF NOT public.hoopdata_purge_expired_competition_snapshots() THEN RAISE EXCEPTION 'Expired data not purged'; END IF;
 IF EXISTS(SELECT 1 FROM public.hoopdata_competition_snapshots WHERE kind='seasons') OR EXISTS(SELECT 1 FROM public.hoopdata_standings_attestations WHERE season='2026-2027') THEN RAISE EXCEPTION 'Expired snapshot or copied attestation remained'; END IF;
END $cleanup$;
RESET ROLE;
