\set ON_ERROR_STOP on
-- Standalone synthetic fixture ONLY. Never sourced by actual-schema runner.
CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;CREATE SCHEMA hoopcheck_security;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users ON DELETE CASCADE,not_after timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
CREATE FUNCTION public.confirm_active_account_session() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('fixture.active',true)='yes'$$;
CREATE FUNCTION hoopcheck_security.mfa_satisfied() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('fixture.mfa',true)='yes'$$;
CREATE TABLE public.player_contact_requests(id uuid PRIMARY KEY,requester_id uuid,player_id uuid,status text);
CREATE TABLE public.player_contact_messages(id uuid PRIMARY KEY,request_id uuid,sender_id uuid,body text);
CREATE TABLE public.user_blocks(blocker_id uuid,blocked_id uuid);
CREATE TABLE public.notifications(id uuid PRIMARY KEY,user_id uuid,target_type text,target_id uuid,notification_type text,title text,body text,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_own ON public.notifications FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY hoopchat_notification_visibility ON public.notifications AS RESTRICTIVE FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT USAGE ON SCHEMA auth,hoopcheck_security TO authenticated;
GRANT SELECT,UPDATE ON public.notifications TO authenticated;
\ir ../candidates/private_chat_push_review_only.sql
INSERT INTO auth.users VALUES('11111111-1111-4111-8111-111111111111',now(),NULL,NULL),('22222222-2222-4222-8222-222222222222',now(),NULL,NULL);
INSERT INTO auth.sessions VALUES('a1111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',NULL),('a2222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222',NULL);
INSERT INTO public.player_contact_requests VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','accepted');
SET request.jwt.claims='{"role":"service_role"}';
DO $$BEGIN IF public.claim_private_chat_push()->>'state'<>'disabled' THEN RAISE EXCEPTION 'Default off bypass';END IF;END$$;
SET fixture.active='yes';SET fixture.mfa='yes';
SET ROLE authenticated;
SET request.jwt.claims='{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","session_id":"a1111111-1111-4111-8111-111111111111"}';
DO $$BEGIN
 IF public.my_chat_push_preference() THEN RAISE EXCEPTION 'Unexpected opt-in';END IF;
 BEGIN PERFORM public.my_chat_push_preference(true);RAISE EXCEPTION 'Disabled opt-in';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END$$;
RESET ROLE;
UPDATE hoopcheck_push_private.config SET enabled=true;
SET ROLE authenticated;
DO $$BEGIN
 IF NOT public.my_chat_push_preference(true) THEN RAISE EXCEPTION 'Opt-in failed';END IF;
 IF NOT public.my_chat_push_device('44444444-4444-4444-8444-444444444444','ios','ExpoPushToken[fixture_token_123456789]') THEN RAISE EXCEPTION 'Registration failed';END IF;
 IF NOT public.my_chat_push_device('44444444-4444-4444-8444-444444444444','ios','ExpoPushToken[fixture_token_123456789]') THEN RAISE EXCEPTION 'Idempotent registration failed';END IF;
 IF NOT public.my_chat_push_device('44444444-4444-4444-8444-444444444444','ios','ExpoPushToken['||repeat('a',256)||']') THEN RAISE EXCEPTION 'Maximum token length rejected';END IF;
 BEGIN PERFORM public.my_chat_push_device('44444444-4444-4444-8444-444444444444','ios','ExpoPushToken['||repeat('a',257)||']');RAISE EXCEPTION 'Oversized token accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM public.my_chat_push_device('44444444-4444-4444-8444-444444444444','ios','ExpoPushToken[fixture_token_123456789]');
 BEGIN PERFORM public.claim_private_chat_push();RAISE EXCEPTION 'Client claimed queue';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END$$;
SET request.jwt.claims='{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222","session_id":"a2222222-2222-4222-8222-222222222222"}';
DO $$BEGIN
 PERFORM public.my_chat_push_preference(true);
 BEGIN PERFORM public.my_chat_push_device('44444444-4444-4444-8444-444444444444','ios','ExpoPushToken[fixture_token_123456789]');RAISE EXCEPTION 'Cross-account token claim';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END$$;
RESET ROLE;
INSERT INTO public.player_contact_messages VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','private message never sent to provider');
INSERT INTO public.notifications(id,user_id,target_type,target_id,notification_type,title,body) VALUES('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','conversation','33333333-3333-4333-8333-333333333333','chat_message','generic','generic');
SET ROLE authenticated;
SET request.jwt.claims='{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","session_id":"a1111111-1111-4111-8111-111111111111"}';
DO $$BEGIN
 BEGIN UPDATE public.notifications SET body='forged' WHERE id='55555555-5555-4555-8555-555555555555';RAISE EXCEPTION 'Private notice editable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END$$;
RESET ROLE;
SET request.jwt.claims='{"role":"service_role"}';
DO $f$ DECLARE l jsonb; n uuid; d uuid; f uuid; BEGIN
 IF (SELECT count(*) FROM hoopcheck_push_private.deliveries)<>1 THEN RAISE EXCEPTION 'Duplicate or missing queue';END IF;
 l:=public.claim_private_chat_push();n:=(l->>'notice_id')::uuid;d:=(l->>'device_id')::uuid;f:=(l->>'fence')::uuid;
 IF l->>'state'<>'leased' OR public.claim_private_chat_push()->>'state'<>'idle' THEN RAISE EXCEPTION 'Duplicate lease';END IF;
 IF public.resolve_private_chat_push(n,d,f)->>'token'<>'ExpoPushToken[fixture_token_123456789]' THEN RAISE EXCEPTION 'Missing recipient';END IF;
 INSERT INTO public.user_blocks VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
 IF public.resolve_private_chat_push(n,d,f) IS NOT NULL THEN RAISE EXCEPTION 'Blocked recipient resolved';END IF;
 DELETE FROM public.user_blocks;
 IF public.finish_private_chat_push(n,d,gen_random_uuid(),'sent') THEN RAISE EXCEPTION 'Stale fence accepted';END IF;
 IF NOT public.finish_private_chat_push(n,d,f,'retry') THEN RAISE EXCEPTION 'Retry not recorded';END IF;
 UPDATE hoopcheck_push_private.deliveries SET next_attempt=now()-interval '1 second';
 l:=public.claim_private_chat_push();
 IF l->>'state'<>'leased' THEN RAISE EXCEPTION 'Retry not claimed';END IF;
 UPDATE hoopcheck_push_private.deliveries SET lease_until=now()-interval '1 second';
 IF public.claim_private_chat_push()->>'state'<>'idle' OR NOT EXISTS(SELECT FROM hoopcheck_push_private.deliveries WHERE state='uncertain') THEN RAISE EXCEPTION 'Ambiguous delivery replayed';END IF;
END $f$;
DELETE FROM auth.sessions WHERE id='a1111111-1111-4111-8111-111111111111';
DO $$BEGIN IF EXISTS(SELECT FROM hoopcheck_push_private.devices) OR EXISTS(SELECT FROM hoopcheck_push_private.deliveries) THEN RAISE EXCEPTION 'Revoked session left registration';END IF;END$$;
SELECT 'PASS generic private chat push registry, token ownership, block recheck, ambiguous delivery and session revocation';
