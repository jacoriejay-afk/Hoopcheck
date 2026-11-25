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

\ir ../candidates/hoopdata_competition_refresh_review_only.sql
INSERT INTO public.hoopdata_competition_refresh_jobs(league_id,kind)
VALUES('33333333-3333-4333-8333-333333333333','seasons');
DO $refresh_access$ BEGIN
  IF has_table_privilege('authenticated','public.hoopdata_competition_refresh_jobs','SELECT') OR
     has_function_privilege('anon','public.hoopdata_claim_competition_refresh()','EXECUTE') OR
     has_column_privilege('service_role','public.hoopdata_competition_refresh_jobs','enabled','UPDATE') THEN RAISE EXCEPTION 'Refresh access too broad'; END IF;
END $refresh_access$;
SET ROLE service_role;
DO $disabled_refresh$ BEGIN
  IF public.hoopdata_claim_competition_refresh() IS NOT NULL THEN RAISE EXCEPTION 'Disabled quota accepted'; END IF;
END $disabled_refresh$;
UPDATE public.hoopdata_quota_pools SET enabled=true WHERE pool='api-sports-basketball';
DO $disabled_job$ BEGIN
  IF public.hoopdata_claim_competition_refresh() IS NOT NULL THEN RAISE EXCEPTION 'Disabled job accepted'; END IF;
END $disabled_job$;
RESET ROLE;
UPDATE public.hoopdata_competition_refresh_jobs SET enabled=true;
SET ROLE service_role;
DO $refresh$ DECLARE
  j jsonb;
  l uuid:='33333333-3333-4333-8333-333333333333';
  token uuid;
BEGIN
  j:=public.hoopdata_claim_competition_refresh();
  IF j IS NULL OR j->>'kind'<>'seasons' THEN RAISE EXCEPTION 'Reviewed job not leased'; END IF;
  token:=(j->>'leaseToken')::uuid;
  IF public.hoopdata_claim_competition_refresh() IS NOT NULL THEN RAISE EXCEPTION 'Job claimed twice'; END IF;
  IF public.hoopdata_finish_competition_refresh(l,'seasons',gen_random_uuid(),'staged',NULL) THEN RAISE EXCEPTION 'Wrong token completed lease'; END IF;
  IF NOT public.hoopdata_finish_competition_refresh(l,'seasons',token,'staged',NULL) THEN RAISE EXCEPTION 'Valid token rejected'; END IF;
  IF public.hoopdata_claim_competition_refresh() IS NOT NULL THEN RAISE EXCEPTION 'Cadence ignored'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.hoopdata_competition_refresh_jobs WHERE league_id=l AND last_state='staged' AND last_success_at IS NOT NULL AND next_due_at>now()+interval '23 hours' AND lease_token IS NULL) THEN RAISE EXCEPTION 'Completion not persisted'; END IF;
END $refresh$;
RESET ROLE;
UPDATE public.hoopdata_competition_refresh_jobs SET next_due_at=now()-interval '1 minute';
SET ROLE service_role;
DO $refresh_retry$ DECLARE j jsonb; t uuid; l uuid:='33333333-3333-4333-8333-333333333333'; BEGIN
  j:=public.hoopdata_claim_competition_refresh(); t:=(j->>'leaseToken')::uuid;
  IF t IS NULL THEN RAISE EXCEPTION 'Retry test claim missing'; END IF;
  IF NOT public.hoopdata_finish_competition_refresh(l,'seasons',t,'failed',now()+interval '2 hours') THEN RAISE EXCEPTION 'Failure completion rejected'; END IF;
  IF EXISTS(SELECT 1 FROM public.hoopdata_competition_refresh_jobs WHERE next_due_at<now()+interval '2 hours') THEN RAISE EXCEPTION 'Provider cooldown shortened'; END IF;
END $refresh_retry$;
RESET ROLE;

RESET ROLE;
UPDATE public.hoopdata_competition_refresh_jobs SET next_due_at=now()-interval '1 minute';
SET ROLE service_role;
DO $refresh_fencing$ DECLARE
  j jsonb; t uuid;
  l uuid:='33333333-3333-4333-8333-333333333333';
  observed timestamptz;
  payload jsonb:='[{"season":"2026-2027","start":"2026-10-01","end":"2027-06-01","games":true,"standings":true}]';
BEGIN
  j:=public.hoopdata_claim_competition_refresh(); t:=(j->>'leaseToken')::uuid; observed:=clock_timestamp();
  IF t IS NULL THEN RAISE EXCEPTION 'Fencing test lease missing'; END IF;
  IF public.hoopdata_stage_leased_competition_snapshot(l,'seasons',gen_random_uuid(),12,'mens','',observed,payload) THEN RAISE EXCEPTION 'Wrong token staged snapshot'; END IF;
  IF public.hoopdata_stage_leased_competition_snapshot(l,'seasons',t,12,'mens','',observed-interval '10 minutes',payload) THEN RAISE EXCEPTION 'Pre-lease snapshot staged'; END IF;
  IF NOT public.hoopdata_stage_leased_competition_snapshot(l,'seasons',t,12,'mens','',observed,payload) THEN RAISE EXCEPTION 'Valid lease could not stage'; END IF;
  IF NOT public.hoopdata_finish_competition_refresh(l,'seasons',t,'staged',NULL) THEN RAISE EXCEPTION 'Valid lease could not finish'; END IF;
  IF public.hoopdata_stage_leased_competition_snapshot(l,'seasons',t,12,'mens','',clock_timestamp(),payload) THEN RAISE EXCEPTION 'Released lease staged snapshot'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.hoopdata_competition_snapshots WHERE league_id=l AND kind='seasons' AND rows=payload) THEN RAISE EXCEPTION 'Fenced snapshot missing'; END IF;
  IF has_function_privilege('authenticated','public.hoopdata_stage_leased_competition_snapshot(uuid,text,uuid,bigint,text,text,timestamptz,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Leased snapshot exposed'; END IF;
END $refresh_fencing$;
RESET ROLE;

\ir ../candidates/hoopdata_standings_attestation_review_only.sql
DO $attestation_access$ BEGIN
  IF has_table_privilege('authenticated','public.hoopdata_standings_attestations','SELECT')
    OR has_table_privilege('anon','public.hoopdata_standings_team_mappings','SELECT')
    OR has_table_privilege('service_role','public.hoopdata_standings_attestations','INSERT')
    OR has_table_privilege('service_role','public.hoopdata_standings_team_mappings','UPDATE')
    OR has_function_privilege('service_role','public.hoopdata_attest_standings(uuid,bigint,text,timestamptz,jsonb,jsonb,uuid,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.hoopdata_attest_standings(uuid,bigint,text,timestamptz,jsonb,jsonb,uuid,text)','EXECUTE')
  THEN RAISE EXCEPTION 'Attestation privileges too broad'; END IF;
END $attestation_access$;
DO $attest$ DECLARE
  l uuid:='33333333-3333-4333-8333-333333333333';
  reviewer uuid:='11111111-1111-4111-8111-111111111111';
  stamp timestamptz:=clock_timestamp();
  payload jsonb:='[{"teamId":2,"stage":"Regular","group":null,"position":1},{"teamId":3,"stage":"Regular","group":null,"position":2}]';
  roster jsonb:='[{"teamId":3,"stage":"Regular","group":null},{"teamId":2,"stage":"Regular","group":null}]';
BEGIN
  IF NOT public.hoopdata_stage_competition_snapshot(l,12,'mens','standings','2026',stamp,payload) THEN RAISE EXCEPTION 'Test snapshot not staged'; END IF;
  IF public.hoopdata_attest_standings(l,12,'2026',stamp,payload,roster,reviewer,'independent roster') THEN RAISE EXCEPTION 'Missing mappings accepted'; END IF;
  INSERT INTO public.hoopdata_standings_team_mappings(league_id,provider_league_id,provider_team_id,team_id,reviewed_by,evidence)
    VALUES(l,12,2,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reviewer,'synthetic'),
          (l,12,3,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',reviewer,'synthetic');
  IF public.hoopdata_attest_standings(l,12,'2026',stamp,payload,'[{"teamId":2,"stage":"Regular","group":null}]',reviewer,'partial roster') THEN RAISE EXCEPTION 'Partial roster accepted'; END IF;
  IF public.hoopdata_attest_standings(l,12,'2026',stamp,payload,jsonb_set(roster,'{0,stage}','"Playoffs"'),reviewer,'wrong stage') THEN RAISE EXCEPTION 'Wrong stage accepted'; END IF;
  IF public.hoopdata_attest_standings(l,12,'2026',stamp,jsonb_set(payload,'{0,position}','2'),roster,reviewer,'changed payload') THEN RAISE EXCEPTION 'Changed snapshot accepted'; END IF;
  UPDATE public.teams SET active=false WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF public.hoopdata_attest_standings(l,12,'2026',stamp,payload,roster,reviewer,'inactive team') THEN RAISE EXCEPTION 'Inactive team accepted'; END IF;
  UPDATE public.teams SET active=true WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF NOT public.hoopdata_attest_standings(l,12,'2026',stamp,payload,roster,reviewer,'independent roster') THEN RAISE EXCEPTION 'Valid attestation rejected'; END IF;
  IF public.hoopdata_attest_standings(l,12,'2026',stamp,payload,roster,reviewer,'duplicate') THEN RAISE EXCEPTION 'Existing attestation replaced'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.hoopdata_standings_attestations WHERE league_id=l AND snapshot_rows=payload AND reviewed_roster=roster AND reviewed_team_ids->>'2'='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN RAISE EXCEPTION 'Audit evidence missing'; END IF;
  IF NOT public.hoopdata_stage_competition_snapshot(l,12,'mens','standings','2026',clock_timestamp(),jsonb_set(payload,'{0,position}','2')) THEN RAISE EXCEPTION 'Newer snapshot rejected'; END IF;
  IF public.hoopdata_attest_standings(l,12,'2026',stamp,payload,roster,reviewer,'superseded') THEN RAISE EXCEPTION 'Superseded snapshot accepted'; END IF;
END $attest$;

-- Expand the synthetic fixture table only inside the disposable CI database.
ALTER TABLE public.fan_live_games ADD COLUMN team_id uuid,ADD COLUMN opponent_team_id uuid,
ADD COLUMN status text,ADD COLUMN provider_source text,ADD COLUMN score_updated_at timestamptz,
ADD COLUMN scheduled_at timestamptz,ADD COLUMN home_score integer,ADD COLUMN away_score integer;
GRANT SELECT,UPDATE ON public.fan_live_games TO service_role;
UPDATE public.fan_live_games SET team_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
opponent_team_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',status='live',provider_source='api-sports-basketball',
score_updated_at=now()-interval '40 minutes',scheduled_at='2026-11-25T20:00:00Z',home_score=80,away_score=90
WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
\ir ../candidates/hoopdata_fallback_overlay_review_only.sql
INSERT INTO public.hoopdata_fallback_team_aliases(provider,provider_team_id,team_id,reviewed_by,evidence) VALUES
('balldontlie-nba','1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','fixture review'),
('balldontlie-nba','2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','fixture review');
DO $overlay_access$ BEGIN
  IF has_table_privilege('authenticated','public.hoopdata_fallback_overlays','SELECT') OR
    has_table_privilege('service_role','public.hoopdata_fallback_team_aliases','INSERT') OR
    has_function_privilege('anon','public.hoopdata_read_fallback_overlay(uuid)','EXECUTE') OR
    has_function_privilege('authenticated','public.hoopdata_stage_fallback_overlay(uuid,text,text,text,timestamptz,integer,integer,timestamptz,timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'Fallback access too broad';
  END IF;
END $overlay_access$;
SET ROLE service_role;
DO $overlay_test$ DECLARE
  g uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  t timestamptz:=clock_timestamp();
  primary_at timestamptz;
  tip timestamptz:='2026-11-25T20:00:00Z';
BEGIN
  SELECT score_updated_at INTO primary_at FROM public.fan_live_games WHERE id=g;
  IF public.hoopdata_stage_fallback_overlay(g,'43','1','2',tip,98,91,primary_at,t) OR
     public.hoopdata_stage_fallback_overlay(g,'42','1','3',tip,98,91,primary_at,t) OR
     public.hoopdata_stage_fallback_overlay(g,'42','1','2',tip,85,91,primary_at,t) OR
     public.hoopdata_stage_fallback_overlay(g,'42','1','2',tip,98,91,primary_at-interval '1 second',t) THEN
    RAISE EXCEPTION 'Unsafe fallback accepted';
  END IF;
  IF NOT public.hoopdata_stage_fallback_overlay(g,'42','1','2',tip,98,91,primary_at,t) THEN RAISE EXCEPTION 'Valid fallback rejected'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.hoopdata_read_fallback_overlay(g) WHERE home_score=91 AND away_score=98) THEN RAISE EXCEPTION 'Overlay missing or wrong orientation'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.fan_live_games WHERE id=g AND home_score=80 AND away_score=90) THEN RAISE EXCEPTION 'Canonical score modified'; END IF;
  IF public.hoopdata_stage_fallback_overlay(g,'42','1','2',tip,98,91,primary_at,t) THEN RAISE EXCEPTION 'Replay accepted'; END IF;
  UPDATE public.fan_live_games SET score_updated_at=clock_timestamp() WHERE id=g;
  IF EXISTS(SELECT 1 FROM public.hoopdata_read_fallback_overlay(g)) THEN RAISE EXCEPTION 'Overlay survived primary recovery'; END IF;
  IF public.hoopdata_stage_fallback_overlay(g,'42','1','2',tip,99,92,primary_at,clock_timestamp()) THEN RAISE EXCEPTION 'Old primary accepted'; END IF;
END $overlay_test$;
RESET ROLE;
