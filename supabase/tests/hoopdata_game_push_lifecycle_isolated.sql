\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'hoopcheck_hoopdata_budget_test' THEN RAISE EXCEPTION 'Isolated test only'; END IF; END $$;
CREATE TABLE public.user_preferences(user_id uuid PRIMARY KEY,notifications_enabled boolean);
CREATE TABLE public.user_watchlists(user_id uuid,target_type text,target_id uuid,notify boolean);
GRANT SELECT ON public.user_preferences,public.user_watchlists TO service_role;
ALTER TABLE public.fan_live_games ADD COLUMN league_id uuid, ADD COLUMN provider_league_id bigint;
UPDATE public.fan_live_games SET team_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',opponent_team_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',status='scheduled',provider_source='api-sports-basketball',league_id='33333333-3333-4333-8333-333333333333',provider_league_id=12,scheduled_at=now()+interval '29 minutes' WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
INSERT INTO public.user_preferences VALUES('11111111-1111-4111-8111-111111111111',true);
INSERT INTO public.user_watchlists VALUES('11111111-1111-4111-8111-111111111111','team','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
\ir ../candidates/hoopdata_game_push_lifecycle_review_only.sql
UPDATE public.hoopdata_game_push_preferences SET timezone='UTC' WHERE user_id='11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.hoopdata_claim_game_push()','EXECUTE') OR has_function_privilege('anon','public.hoopdata_claim_game_push()','EXECUTE') THEN RAISE EXCEPTION 'Claim exposed'; END IF;
END $$;
SET ROLE service_role;
DO $test$
DECLARE u uuid:='11111111-1111-4111-8111-111111111111'; g uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; t timestamptz; j jsonb; i uuid; k uuid;
BEGIN
 SELECT scheduled_at INTO t FROM public.fan_live_games WHERE id=g;
 IF public.hoopdata_push_time_allowed('America/New_York',1320,420,'2026-11-25T08:00:00Z') IS DISTINCT FROM false OR public.hoopdata_push_time_allowed('America/New_York',1320,420,'2026-11-25T15:00:00Z') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Quiet hours incorrect'; END IF;
 IF public.hoopdata_queue_game_push(u,g,'tip-off',t,NULL) OR public.hoopdata_queue_game_push('22222222-2222-4222-8222-222222222222',g,'tip-off',t,now()+interval '2 hours') THEN RAISE EXCEPTION 'Unauthorized queue'; END IF;
 IF NOT public.hoopdata_queue_game_push(u,g,'tip-off',t,now()+interval '2 hours') OR NOT public.hoopdata_queue_game_push(u,g,'tip-off',t,now()+interval '2 hours') THEN RAISE EXCEPTION 'Queue failed'; END IF;
 IF (SELECT count(*) FROM public.hoopdata_game_push_outbox WHERE game_id=g)<>1 THEN RAISE EXCEPTION 'Duplicate queue'; END IF;
 j:=public.hoopdata_claim_game_push(); i:=(j->>'id')::uuid; k:=(j->>'leaseToken')::uuid;
 IF i IS NULL OR NOT public.hoopdata_validate_game_push_lease(i,k) OR public.hoopdata_claim_game_push() IS NOT NULL THEN RAISE EXCEPTION 'Lease fencing failed'; END IF;
 IF public.hoopdata_finish_game_push(i,gen_random_uuid(),'accepted') THEN RAISE EXCEPTION 'Wrong lease accepted'; END IF;
 IF NOT public.hoopdata_finish_game_push(i,k,'confirmed-not-sent') THEN RAISE EXCEPTION 'Finish failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.hoopdata_game_push_outbox WHERE id=i AND status='pending' AND next_attempt_at>now()) THEN RAISE EXCEPTION 'Retry not deferred'; END IF;
 UPDATE public.hoopdata_game_push_outbox SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=i;
 j:=public.hoopdata_claim_game_push(); k:=(j->>'leaseToken')::uuid;
 IF k IS NULL OR NOT public.hoopdata_finish_game_push(i,k,'uncertain') THEN RAISE EXCEPTION 'Uncertain finish failed'; END IF;
 IF public.hoopdata_queue_game_push(u,g,'tip-off',t,now()+interval '2 hours') OR public.hoopdata_claim_game_push() IS NOT NULL THEN RAISE EXCEPTION 'Uncertain delivery retried'; END IF;
END $test$;
RESET ROLE;
