-- Supplemental synthetic test, runs within the existing fixture transaction.
ALTER TABLE public.profiles ADD COLUMN display_name text,ADD COLUMN username text;
UPDATE public.profiles SET display_name='Fixture contact',username='fixture';
GRANT SELECT(id,display_name,username) ON public.profiles TO authenticated;
ALTER TABLE public.player_contact_requests ADD COLUMN message text,ADD COLUMN created_at timestamptz NOT NULL DEFAULT '2026-11-01T00:00:00.123456Z';
\ir ../candidates/step1_hoopchat_server_inbox_review_only.sql
-- Generate more than the legacy five-page limit, preserving equal timestamps.
INSERT INTO public.player_contact_requests(id,requester_id,player_id,status,message)
 SELECT ('12345678-1234-4234-8234-'||lpad(i::text,12,'0'))::uuid,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','accepted',CASE WHEN i=1 THEN 'needle beyond five pages' ELSE 'fixture' END FROM generate_series(1,601) i;
INSERT INTO public.player_contact_messages(id,request_id,sender_id,body,created_at)
 VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd','12345678-1234-4234-8234-000000000001','22222222-2222-4222-8222-222222222222','searchable message beyond limit','2026-11-28T00:00:00Z');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
SET LOCAL fixture.session='active';SET LOCAL fixture.mfa='verified';SET LOCAL fixture.blocked_request='';
DO $f$ DECLARE page jsonb; tail jsonb; seen int:=0; at_time timestamptz; at_id uuid; n int:=0; BEGIN
 LOOP
 page:=public.hoopchat_inbox_page('','all',at_time,at_id);
 seen:=seen+jsonb_array_length(page->'rows'); n:=n+1;
 EXIT WHEN NOT (page->>'has_more')::boolean;
 tail:=page->'rows'->99;at_time:=(tail->>'created_at')::timestamptz;at_id:=(tail->>'id')::uuid;
 IF n>10 THEN RAISE EXCEPTION 'cursor loop'; END IF;
 END LOOP;
 IF seen<601 OR n<7 THEN RAISE EXCEPTION 'inbox limit remains'; END IF;
 IF jsonb_array_length(public.hoopchat_inbox_page('needle beyond five pages')->'rows')<>1 OR jsonb_array_length(public.hoopchat_inbox_page('searchable message beyond limit')->'rows')<>1 THEN RAISE EXCEPTION 'server search incomplete'; END IF;
 IF public.hoopchat_unread_total()<1 THEN RAISE EXCEPTION 'unread count absent'; END IF;
 PERFORM set_config('fixture.blocked_request','12345678-1234-4234-8234-000000000001',true);
 IF jsonb_array_length(public.hoopchat_inbox_page('needle beyond five pages')->'rows')<>0 OR jsonb_array_length(public.hoopchat_inbox_page('searchable message beyond limit')->'rows')<>0 THEN RAISE EXCEPTION 'blocked search leak'; END IF;
 PERFORM set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 IF jsonb_array_length(public.hoopchat_inbox_page('needle beyond five pages')->'rows')<>0 THEN RAISE EXCEPTION 'foreign search leak'; END IF;
 PERFORM set_config('fixture.session','revoked',true);
 BEGIN PERFORM public.hoopchat_unread_total(); RAISE EXCEPTION 'revoked unread access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END $f$;
RESET ROLE;
SELECT 'PASS synthetic server-wide search, 601+ rows, keyset pagination, unread and block/session scope';
