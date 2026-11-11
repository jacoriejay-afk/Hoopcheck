-- SEASON-1 provider identity staging smoke test. STAGING ONLY; rollback always.
BEGIN;
INSERT INTO public.leagues(id,name,country,season_start_month,season_start_day,season_end_month,season_end_day)
VALUES ('11111111-1111-4111-8111-111111111111','Gate test','Test',1,1,12,31);
INSERT INTO public.fan_live_league_provider_map(provider_source,provider_league_id,league_id)
VALUES ('api-sports-basketball',987654321,'11111111-1111-4111-8111-111111111111');
INSERT INTO public.fan_live_games(id,status,scheduled_at,provider_source,provider_league_id,league_id)
VALUES ('22222222-2222-4222-8222-222222222222','scheduled',now()+interval '1 hour','api-sports-basketball',987654321,'11111111-1111-4111-8111-111111111111');
DO $test$
DECLARE matched integer;
BEGIN
 SELECT count(*) INTO matched FROM public.fan_live_games g
 JOIN public.fan_live_league_provider_map m
 ON m.provider_source=g.provider_source AND m.provider_league_id=g.provider_league_id AND m.league_id=g.league_id
 WHERE g.status IN ('live','scheduled');
 IF matched<>1 THEN RAISE EXCEPTION 'Verified fixture mapping test failed'; END IF;
 UPDATE public.fan_live_games SET provider_league_id=NULL WHERE id='22222222-2222-4222-8222-222222222222';
 SELECT count(*) INTO matched FROM public.fan_live_games g
 JOIN public.fan_live_league_provider_map m
 ON m.provider_source=g.provider_source AND m.provider_league_id=g.provider_league_id AND m.league_id=g.league_id
 WHERE g.status IN ('live','scheduled');
 IF matched<>0 THEN RAISE EXCEPTION 'Missing provider identity was not rejected'; END IF;
END $test$;
ROLLBACK;
