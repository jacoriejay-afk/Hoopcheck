-- SEASON-1 transactional staging smoke test. Never run on production.
-- Tests active, off-season, unmapped and cancelled chat room gating.
BEGIN;
INSERT INTO public.leagues(id,name,country,season_start_month,season_start_day,season_end_month,season_end_day) VALUES
('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','SEASON-1 in-season fixture','Test',1,1,12,31),
('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','SEASON-1 off-season fixture','Test',
 CASE WHEN EXTRACT(MONTH FROM now())=1 THEN 7 ELSE 1 END,1,
 CASE WHEN EXTRACT(MONTH FROM now())=1 THEN 8 ELSE 2 END,28);
INSERT INTO public.fan_live_games(id,status,scheduled_at,league_id) VALUES
('aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa','scheduled',now()+interval '30 minutes','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
('bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb','scheduled',now()+interval '30 minutes','bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'),
('cccccccc-5555-4555-8555-cccccccccccc','scheduled',now()+interval '30 minutes',NULL),
('dddddddd-6666-4666-8666-dddddddddddd','cancelled',now()+interval '30 minutes','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
DO $season_smoke$
BEGIN
 IF NOT public.fan_live_chat_room_open('aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa') THEN RAISE EXCEPTION 'In-season room should open'; END IF;
 IF public.fan_live_chat_room_open('bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb') THEN RAISE EXCEPTION 'Off-season room must close'; END IF;
 IF public.fan_live_chat_room_open('cccccccc-5555-4555-8555-cccccccccccc') THEN RAISE EXCEPTION 'Unmapped room must close'; END IF;
 IF public.fan_live_chat_room_open('dddddddd-6666-4666-8666-dddddddddddd') THEN RAISE EXCEPTION 'Cancelled room must close'; END IF;
END $season_smoke$;
ROLLBACK;
