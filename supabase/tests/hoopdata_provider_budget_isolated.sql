\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() <> 'hoopcheck_hoopdata_budget_test' THEN
    RAISE EXCEPTION 'Use only isolated HOOPDATA test database';
  END IF;
END $$;
-- CI uses disposable roles in a local Postgres service.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
\ir ../candidates/hoopdata_provider_budget_review_only.sql
INSERT INTO public.hoopdata_quota_pools(pool,enabled,max_per_minute,max_per_day)
VALUES ('balldontlie',true,2,3),('api-sports-basketball',false,1,96);
DO $$ BEGIN
  IF has_function_privilege('authenticated','public.hoopdata_reserve_request(text)','EXECUTE') OR
     has_function_privilege('anon','public.hoopdata_reserve_request(text)','EXECUTE') OR
     has_table_privilege('authenticated','public.hoopdata_request_reservations','SELECT') THEN
    RAISE EXCEPTION 'Client quota access leaked';
  END IF;
END $$;
SET ROLE service_role;
DO $$ BEGIN
  IF public.hoopdata_reserve_request('api-sports-basketball') OR public.hoopdata_reserve_request('unknown') THEN RAISE EXCEPTION 'Unknown or disabled pool accepted'; END IF;
  IF NOT public.hoopdata_reserve_request('balldontlie') OR NOT public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Within budget rejected'; END IF;
  IF public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Minute budget exceeded'; END IF;
  UPDATE public.hoopdata_request_reservations SET reserved_at=clock_timestamp()-interval '2 minutes' WHERE pool='balldontlie';
  IF NOT public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Sliding minute did not reset'; END IF;
  IF public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Daily budget exceeded'; END IF;
  UPDATE public.hoopdata_request_reservations SET reserved_at=clock_timestamp()-interval '25 hours' WHERE pool='balldontlie';
  UPDATE public.hoopdata_quota_pools SET blocked_until=clock_timestamp()+interval '5 minutes' WHERE pool='balldontlie';
  IF public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Retry cooldown ignored'; END IF;
  UPDATE public.hoopdata_quota_pools SET blocked_until=NULL WHERE pool='balldontlie';
  IF NOT public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Rolling daily budget failed to reset'; END IF;
END $$;
RESET ROLE;

-- Synthetic canonical game table in this isolated DB only.
CREATE TABLE public.fan_live_games(id uuid PRIMARY KEY);
INSERT INTO public.fan_live_games(id) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
\ir ../candidates/hoopdata_game_aliases_review_only.sql
DO $$ BEGIN
  IF has_table_privilege('authenticated','public.hoopdata_game_aliases','SELECT') OR
     has_table_privilege('anon','public.hoopdata_game_aliases','INSERT') OR
     has_table_privilege('service_role','public.hoopdata_game_aliases','UPDATE') THEN
    RAISE EXCEPTION 'Alias privileges too broad';
  END IF;
END $$;
SET ROLE service_role;
INSERT INTO public.hoopdata_game_aliases(provider,provider_game_id,canonical_game_id,reviewed_by,evidence) VALUES
('balldontlie-nba','42','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','synthetic evidence'),
('balldontlie-wnba','42','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','synthetic evidence');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.hoopdata_game_aliases(provider,provider_game_id,canonical_game_id,reviewed_by,evidence)
    VALUES ('balldontlie-nba','42','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','duplicate provider identity');
    RAISE EXCEPTION 'Duplicate provider identity accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.hoopdata_game_aliases(provider,provider_game_id,canonical_game_id,reviewed_by,evidence)
    VALUES ('balldontlie-nba','43','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','duplicate canonical identity');
    RAISE EXCEPTION 'Duplicate canonical identity accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.hoopdata_game_aliases(provider,provider_game_id,canonical_game_id,reviewed_by,evidence)
    VALUES ('balldontlie-nba','44','cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','unknown canonical identity');
    RAISE EXCEPTION 'Missing canonical fixture accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
RESET ROLE;

\ir ../candidates/hoopdata_season_import_review_only.sql
DO $access$ BEGIN
  IF has_table_privilege('authenticated','public.hoopdata_fixture_stage','SELECT') OR
     has_function_privilege('anon','public.hoopdata_commit_season_page(text,integer,bigint,bigint,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Season import exposed to clients';
  END IF;
END $access$;
SET ROLE service_role;
DO $import$ DECLARE
  page1 jsonb := '[{"provider":"balldontlie-nba","season":2026,"id":"42"}]';
  page2 jsonb := '[{"provider":"balldontlie-nba","season":2026,"id":"43"}]';
BEGIN
  IF public.hoopdata_commit_season_page('balldontlie-nba',2026,NULL,10,page1||page1) THEN RAISE EXCEPTION 'Duplicate page accepted'; END IF;
  IF NOT public.hoopdata_commit_season_page('balldontlie-nba',2026,NULL,10,page1) THEN RAISE EXCEPTION 'First page rejected'; END IF;
  IF public.hoopdata_commit_season_page('balldontlie-nba',2026,NULL,10,page1) THEN RAISE EXCEPTION 'Old cursor accepted'; END IF;
  IF public.hoopdata_commit_season_page('balldontlie-nba',2026,10,10,page2) THEN RAISE EXCEPTION 'Nonadvancing cursor accepted'; END IF;
  IF public.hoopdata_commit_season_page('balldontlie-wnba',2026,NULL,NULL,page1) THEN RAISE EXCEPTION 'Wrong league accepted'; END IF;
  IF NOT public.hoopdata_commit_season_page('balldontlie-nba',2026,10,NULL,page2) THEN RAISE EXCEPTION 'Last page rejected'; END IF;
  IF public.hoopdata_commit_season_page('balldontlie-nba',2026,NULL,NULL,page1) THEN RAISE EXCEPTION 'Completed job overwritten'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.hoopdata_season_imports WHERE provider='balldontlie-nba' AND season=2026 AND completed AND pages=2 AND next_cursor IS NULL) THEN RAISE EXCEPTION 'Checkpoint incorrect'; END IF;
  IF (SELECT count(*) FROM public.hoopdata_fixture_stage)<>2 THEN RAISE EXCEPTION 'Page persistence incorrect'; END IF;
END $import$;
RESET ROLE;

-- Minimal synthetic organization/claim schema for manager proposal RLS.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $uid$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $uid$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,account_type text NOT NULL);
CREATE TABLE public.leagues(id uuid PRIMARY KEY,active boolean,basketball_type text);
CREATE TABLE public.teams(id uuid PRIMARY KEY,active boolean,league_id uuid REFERENCES public.leagues(id),basketball_type text);
CREATE TABLE public.profile_claim_requests(requester_id uuid,entity_type text,entity_id uuid,status text);
INSERT INTO public.profiles VALUES('11111111-1111-4111-8111-111111111111','manager'),('22222222-2222-4222-8222-222222222222','manager');
INSERT INTO public.leagues VALUES('33333333-3333-4333-8333-333333333333',true,'mens');
INSERT INTO public.teams VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'33333333-3333-4333-8333-333333333333','mens'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true,'33333333-3333-4333-8333-333333333333','mens');
INSERT INTO public.profile_claim_requests VALUES('11111111-1111-4111-8111-111111111111','team','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved'),('22222222-2222-4222-8222-222222222222','team','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','pending');
GRANT SELECT ON public.profiles,public.teams,public.leagues,public.profile_claim_requests TO authenticated;
\ir ../candidates/hoopdata_manager_submissions_review_only.sql
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.hoopdata_manager_submissions(team_id,opponent_team_id,league_id,scheduled_at,kind,evidence,request_id)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333',now()+interval '2 days','schedule','official fixture reference','44444444-4444-4444-8444-444444444444');
DO $manager$ BEGIN
  IF (SELECT count(*) FROM public.hoopdata_manager_submissions WHERE status='pending')<>1 THEN RAISE EXCEPTION 'Verified manager pending proposal missing'; END IF;
  BEGIN
    UPDATE public.hoopdata_manager_submissions SET status='approved';
    RAISE EXCEPTION 'Manager self-approved';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.hoopdata_manager_submissions(team_id,opponent_team_id,league_id,scheduled_at,kind,evidence,request_id)
    VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',now()+interval '2 days','schedule','other club','55555555-5555-4555-8555-555555555555');
    RAISE EXCEPTION 'Other club accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $manager$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $unverified$ BEGIN
  IF EXISTS(SELECT 1 FROM public.hoopdata_manager_submissions) THEN RAISE EXCEPTION 'Other manager private proposals leaked'; END IF;
  BEGIN
    INSERT INTO public.hoopdata_manager_submissions(team_id,opponent_team_id,league_id,scheduled_at,kind,evidence,request_id)
    VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',now()+interval '2 days','schedule','pending club','66666666-6666-4666-8666-666666666666');
    RAISE EXCEPTION 'Unverified manager accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $unverified$;
RESET ROLE;

\ir ../candidates/hoopdata_game_push_outbox_review_only.sql
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.hoopdata_game_push_preferences(user_id,enabled) VALUES('11111111-1111-4111-8111-111111111111',true);
DO $pref$ BEGIN
  BEGIN
    INSERT INTO public.hoopdata_game_push_preferences(user_id,enabled) VALUES('22222222-2222-4222-8222-222222222222',true);
    RAISE EXCEPTION 'Other account opted in';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF has_table_privilege('authenticated','public.hoopdata_game_push_outbox','SELECT') OR has_table_privilege('authenticated','public.hoopdata_game_push_outbox','INSERT') THEN RAISE EXCEPTION 'Outbox exposed'; END IF;
END $pref$;
RESET ROLE;
SET ROLE service_role;
INSERT INTO public.hoopdata_game_push_outbox(user_id,game_id,event_kind,scheduled_tipoff,available_at)
VALUES('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','game-day',now()+interval '1 hour',now());
DO $dedupe$ BEGIN
  BEGIN
    INSERT INTO public.hoopdata_game_push_outbox(user_id,game_id,event_kind,scheduled_tipoff,available_at)
    VALUES('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','game-day',now()+interval '1 hour',now());
    RAISE EXCEPTION 'Duplicate notification accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $dedupe$;
RESET ROLE;

\ir ../candidates/hoopdata_competition_preview_review_only.sql
DO $competition_access$ BEGIN
  IF has_table_privilege('authenticated','public.hoopdata_competition_preview_snapshots','SELECT') OR
     has_table_privilege('anon','public.hoopdata_competition_preview_targets','SELECT') OR
     has_table_privilege('service_role','public.hoopdata_competition_preview_targets','INSERT') OR
     has_table_privilege('service_role','public.hoopdata_competition_preview_snapshots','UPDATE') THEN
    RAISE EXCEPTION 'Competition preview privileges too broad';
  END IF;
END $competition_access$;
INSERT INTO public.hoopdata_competition_preview_targets(league_id) VALUES(12);
DO $target_default$ BEGIN
  IF EXISTS(SELECT 1 FROM public.hoopdata_competition_preview_targets WHERE enabled) THEN
    RAISE EXCEPTION 'Preview target enabled by default';
  END IF;
END $target_default$;
UPDATE public.hoopdata_competition_preview_targets SET enabled=true WHERE league_id=12;
SET ROLE service_role;
INSERT INTO public.hoopdata_competition_preview_snapshots(league_id,endpoint,season,observed_at,rows)
VALUES(12,'standings','2025-2026',now(),'[{"teamId":3,"position":2}]');
DO $competition_stage$ BEGIN
  IF (SELECT count(*) FROM public.hoopdata_competition_preview_snapshots)<>1 THEN RAISE EXCEPTION 'Snapshot not staged'; END IF;
  BEGIN
    INSERT INTO public.hoopdata_competition_preview_snapshots(league_id,endpoint,season,observed_at,rows)
    VALUES(13,'games','2026',now(),'[]');
    RAISE EXCEPTION 'Unknown league accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.hoopdata_competition_preview_snapshots(league_id,endpoint,season,observed_at,rows)
    VALUES(12,'games',NULL,now(),'[]');
    RAISE EXCEPTION 'Missing season accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $competition_stage$;
RESET ROLE;

\ir ../candidates/hoopdata_competition_snapshots_review_only.sql
DO $mapped_access$ BEGIN
  IF has_table_privilege('anon','public.hoopdata_competition_mappings','SELECT') OR
     has_table_privilege('authenticated','public.hoopdata_competition_snapshots','SELECT') OR
     has_function_privilege('authenticated','public.hoopdata_stage_competition_snapshot(uuid,bigint,text,text,text,timestamptz,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Private mapped snapshot privileges exposed';
  END IF;
END $mapped_access$;
GRANT SELECT ON public.leagues TO service_role;
INSERT INTO public.hoopdata_competition_mappings(league_id,provider_league_id,side,evidence)
VALUES('33333333-3333-4333-8333-333333333333',12,'mens','synthetic evidence');
SET ROLE service_role;
DO $unreviewed$ BEGIN
  IF public.hoopdata_stage_competition_snapshot('33333333-3333-4333-8333-333333333333',12,'mens','standings','2026',now(),'[{"teamId":2,"position":1}]') THEN
    RAISE EXCEPTION 'Unreviewed competition staged';
  END IF;
END $unreviewed$;
RESET ROLE;
UPDATE public.hoopdata_competition_mappings SET reviewed=true,reviewed_by='11111111-1111-4111-8111-111111111111',reviewed_at=now();
SET ROLE service_role;
DO $mapped_stage$ DECLARE
  l uuid:='33333333-3333-4333-8333-333333333333';
  t timestamptz:=clock_timestamp();
BEGIN
  IF public.hoopdata_stage_competition_snapshot(l,12,'womens','standings','2026',t,'[{"teamId":2,"position":1}]') THEN RAISE EXCEPTION 'Wrong basketball side staged'; END IF;
  IF public.hoopdata_stage_competition_snapshot(l,13,'mens','standings','2026',t,'[{"teamId":2,"position":1}]') THEN RAISE EXCEPTION 'Wrong provider competition staged'; END IF;
  IF NOT public.hoopdata_stage_competition_snapshot(l,12,'mens','standings','2026',t,'[{"teamId":2,"position":1}]') THEN RAISE EXCEPTION 'Reviewed snapshot not staged'; END IF;
  IF public.hoopdata_stage_competition_snapshot(l,12,'mens','standings','2026',t+interval '1 second','[]') THEN RAISE EXCEPTION 'Empty snapshot staged'; END IF;
  IF public.hoopdata_stage_competition_snapshot(l,12,'mens','standings','2026',t-interval '1 second','[{"teamId":2,"position":2}]') THEN RAISE EXCEPTION 'Older snapshot replaced latest'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.hoopdata_competition_snapshots WHERE league_id=l AND rows='[{"teamId":2,"position":1}]') THEN RAISE EXCEPTION 'Latest valid snapshot not retained'; END IF;
END $mapped_stage$;
RESET ROLE;

\ir ../candidates/hoopdata_sync_jobs_review_only.sql
DO $job_access$ BEGIN
  IF has_table_privilege('anon','public.hoopdata_sync_jobs','SELECT') OR
     has_table_privilege('authenticated','public.hoopdata_sync_jobs','SELECT') OR
     has_table_privilege('service_role','public.hoopdata_sync_jobs','INSERT') OR
     has_column_privilege('service_role','public.hoopdata_sync_jobs','approved','UPDATE') OR
     has_function_privilege('authenticated','public.hoopdata_claim_sync_job(text,text,text)','EXECUTE') OR
     has_function_privilege('anon','public.hoopdata_finish_sync_job(text,uuid,text,timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'Sync job privileges too broad';
  END IF;
END $job_access$;
INSERT INTO public.hoopdata_sync_jobs(id,pool,kind) VALUES('unapproved','balldontlie','live');
INSERT INTO public.hoopdata_sync_jobs(id,pool,kind,approved) VALUES
('active','balldontlie','live',true),('disabled-pool','api-sports-basketball','live',true),
('expired','balldontlie','live',true);
UPDATE public.hoopdata_sync_jobs SET lease_token='11111111-1111-4111-8111-111111111111',
lease_expires_at=clock_timestamp()-interval '1 second',last_attempt_at=clock_timestamp()-interval '2 minutes' WHERE id='expired';
SET ROLE service_role;
DO $job_claim$ DECLARE
  tok uuid; replacement uuid;
BEGIN
  IF EXISTS(SELECT 1 FROM public.hoopdata_claim_sync_job('unapproved','balldontlie','live')) OR
     EXISTS(SELECT 1 FROM public.hoopdata_claim_sync_job('disabled-pool','api-sports-basketball','live')) OR
     EXISTS(SELECT 1 FROM public.hoopdata_claim_sync_job('active','balldontlie','schedule')) THEN
    RAISE EXCEPTION 'Unapproved or wrong job claimed';
  END IF;
  SELECT token INTO tok FROM public.hoopdata_claim_sync_job('active','balldontlie','live');
  IF tok IS NULL THEN RAISE EXCEPTION 'Approved job not claimed'; END IF;
  IF EXISTS(SELECT 1 FROM public.hoopdata_claim_sync_job('active','balldontlie','live')) THEN RAISE EXCEPTION 'Duplicate claim'; END IF;
  IF public.hoopdata_finish_sync_job('active','22222222-2222-4222-8222-222222222222','staged',NULL) THEN RAISE EXCEPTION 'Wrong token accepted'; END IF;
  IF NOT public.hoopdata_finish_sync_job('active',tok,'deferred',clock_timestamp()+interval '10 minutes') THEN RAISE EXCEPTION 'Valid completion rejected'; END IF;
  IF public.hoopdata_finish_sync_job('active',tok,'staged',NULL) OR
     EXISTS(SELECT 1 FROM public.hoopdata_claim_sync_job('active','balldontlie','live')) THEN RAISE EXCEPTION 'Completion replay or cooldown bypass'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.hoopdata_sync_jobs WHERE id='active' AND last_outcome='deferred' AND retry_at>clock_timestamp()+interval '9 minutes' AND lease_token IS NULL) THEN RAISE EXCEPTION 'Retry checkpoint missing'; END IF;
  IF public.hoopdata_finish_sync_job('expired','11111111-1111-4111-8111-111111111111','staged',NULL) THEN RAISE EXCEPTION 'Expired lease finished'; END IF;
  SELECT token INTO replacement FROM public.hoopdata_claim_sync_job('expired','balldontlie','live');
  IF replacement IS NULL OR replacement='11111111-1111-4111-8111-111111111111' THEN RAISE EXCEPTION 'Lease not recovered'; END IF;
  IF NOT public.hoopdata_finish_sync_job('expired',replacement,'staged',NULL) THEN RAISE EXCEPTION 'Recovered lease could not finish'; END IF;
END $job_claim$;
RESET ROLE;
