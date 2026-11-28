-- Review-only. Generic chat push, not external activation. Requires the
-- reviewed chat notification ledger and real session/MFA functions.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='20s';
DO $guard$ BEGIN
 IF to_regprocedure('public.confirm_active_account_session()') IS NULL OR to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NULL
 OR to_regclass('hoopcheck_deletion_private.frozen_accounts') IS NULL
 OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.notifications'::regclass AND polname='hoopchat_notification_visibility' AND NOT polpermissive)
 THEN RAISE EXCEPTION 'Review chat notification and session prerequisites'; END IF;
END $guard$;
CREATE SCHEMA hoopcheck_push_private;
REVOKE ALL ON SCHEMA hoopcheck_push_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE hoopcheck_push_private.config(singleton boolean PRIMARY KEY CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO hoopcheck_push_private.config VALUES(true,false);
CREATE TABLE hoopcheck_push_private.preferences(owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,chat_enabled boolean NOT NULL DEFAULT false);
CREATE TABLE hoopcheck_push_private.devices(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,installation_id uuid NOT NULL,
 platform text NOT NULL CHECK(platform IN ('ios','android')),
 token text NOT NULL UNIQUE CHECK(token ~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{16,255}[A-Za-z0-9_-]?\]$'),
 revision uuid NOT NULL DEFAULT gen_random_uuid(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(owner_id,installation_id)
);
CREATE TABLE hoopcheck_push_private.deliveries(
 notice_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
 device_id uuid NOT NULL REFERENCES hoopcheck_push_private.devices(id) ON DELETE CASCADE,
 device_revision uuid NOT NULL, state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','leased','sent','retry','uncertain','cancelled')),
 fence uuid,lease_until timestamptz,attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 next_attempt timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(notice_id,device_id),
 CHECK((state='leased')=(fence IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX push_delivery_pending ON hoopcheck_push_private.deliveries(state,next_attempt) WHERE state IN ('queued','retry');
DO $acl$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['config','preferences','devices','deliveries'] LOOP
 EXECUTE format('ALTER TABLE hoopcheck_push_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON hoopcheck_push_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $acl$;
CREATE FUNCTION hoopcheck_push_private.active() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT auth.uid() IS NOT NULL AND public.confirm_active_account_session() IS TRUE AND hoopcheck_security.mfa_satisfied() IS TRUE
$f$;
CREATE FUNCTION hoopcheck_push_private.session_valid(p_owner uuid,p_session uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT EXISTS(SELECT FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
 WHERE s.id=p_session AND s.user_id=p_owner AND (s.not_after IS NULL OR s.not_after>now()) AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()))
$f$;
CREATE FUNCTION hoopcheck_push_private.preference(p_enabled boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF NOT hoopcheck_push_private.active() THEN RAISE EXCEPTION 'Verify account' USING ERRCODE='42501';END IF;
 IF p_enabled IS NOT NULL THEN
  IF p_enabled AND NOT EXISTS(SELECT FROM hoopcheck_push_private.config WHERE singleton AND enabled) THEN RAISE EXCEPTION 'Push unavailable' USING ERRCODE='42501';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,8027));
  INSERT INTO hoopcheck_push_private.preferences VALUES(uid,p_enabled) ON CONFLICT(owner_id) DO UPDATE SET chat_enabled=excluded.chat_enabled;
  IF NOT p_enabled THEN DELETE FROM hoopcheck_push_private.devices WHERE owner_id=uid;END IF;
 END IF;
 RETURN coalesce((SELECT chat_enabled FROM hoopcheck_push_private.preferences WHERE owner_id=uid),false);
END $f$;
CREATE FUNCTION hoopcheck_push_private.device(p_installation uuid,p_platform text,p_token text,p_revoke boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE uid uuid:=auth.uid(); sid uuid;
BEGIN
 IF NOT hoopcheck_push_private.active() OR p_installation IS NULL OR p_revoke IS NULL THEN RAISE EXCEPTION 'Verify account' USING ERRCODE='42501';END IF;
 sid:=(current_setting('request.jwt.claims',true)::jsonb->>'session_id')::uuid;
 IF sid IS NULL OR NOT hoopcheck_push_private.session_valid(uid,sid) THEN RAISE EXCEPTION 'Verify session' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,8027));
 IF p_revoke THEN DELETE FROM hoopcheck_push_private.devices WHERE owner_id=uid AND installation_id=p_installation AND session_id=sid;RETURN true;END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_push_private.config WHERE singleton AND enabled)
 OR NOT EXISTS(SELECT FROM hoopcheck_push_private.preferences WHERE owner_id=uid AND chat_enabled)
 OR p_platform IS NULL OR p_platform NOT IN ('ios','android') OR p_token IS NULL OR p_token !~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{16,255}[A-Za-z0-9_-]?\]$'
 THEN RAISE EXCEPTION 'Push registration unavailable' USING ERRCODE='42501';END IF;
 -- No account can claim another active registration. On logout, revoke
 -- first; a deleted Auth session also removes its devices and queue.
 IF EXISTS(SELECT FROM hoopcheck_push_private.devices WHERE token=p_token AND (owner_id<>uid OR installation_id<>p_installation)) THEN RAISE EXCEPTION 'Push registration unavailable' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_push_private.devices WHERE owner_id=uid AND installation_id=p_installation)
 AND (SELECT count(*) FROM hoopcheck_push_private.devices WHERE owner_id=uid)>=8 THEN RAISE EXCEPTION 'Device limit reached';END IF;
 INSERT INTO hoopcheck_push_private.devices(owner_id,session_id,installation_id,platform,token)
 VALUES(uid,sid,p_installation,p_platform,p_token)
 ON CONFLICT(owner_id,installation_id) DO UPDATE SET session_id=excluded.session_id,platform=excluded.platform,token=excluded.token,
 revision=CASE WHEN devices.token=excluded.token AND devices.session_id=excluded.session_id AND devices.platform=excluded.platform THEN devices.revision ELSE gen_random_uuid() END,updated_at=clock_timestamp();
 RETURN true;
END $f$;
-- No text, sender, group, thread, target or notice ID leaves HoopCheck.
CREATE FUNCTION hoopcheck_push_private.eligible(p_notice uuid,p_device uuid,p_revision uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT EXISTS(SELECT FROM hoopcheck_push_private.config WHERE singleton AND enabled) AND EXISTS(
 SELECT FROM hoopcheck_push_private.devices d JOIN hoopcheck_push_private.preferences pref ON pref.owner_id=d.owner_id AND pref.chat_enabled
 JOIN public.notifications n ON n.user_id=d.owner_id
 JOIN public.player_contact_messages m ON m.id=n.id AND m.request_id=n.target_id
 JOIN public.player_contact_requests r ON r.id=m.request_id AND r.status='accepted'
 WHERE d.id=p_device AND d.revision=p_revision AND n.id=p_notice AND n.target_type='conversation' AND n.notification_type='chat_message' AND n.read_at IS NULL
 AND n.created_at>now()-interval '10 minutes' AND n.user_id IN (r.requester_id,r.player_id) AND m.sender_id IN (r.requester_id,r.player_id) AND m.sender_id<>n.user_id
 AND hoopcheck_push_private.session_valid(d.owner_id,d.session_id)
 AND NOT EXISTS(SELECT FROM hoopcheck_deletion_private.frozen_accounts f WHERE f.owner_id IN (d.owner_id,m.sender_id))
 AND NOT EXISTS(SELECT FROM public.user_blocks b WHERE (b.blocker_id=m.sender_id AND b.blocked_id=n.user_id) OR (b.blocker_id=n.user_id AND b.blocked_id=m.sender_id)))
$f$;
CREATE FUNCTION hoopcheck_push_private.queue_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF NEW.target_type='conversation' AND NEW.notification_type='chat_message' THEN
  INSERT INTO hoopcheck_push_private.deliveries(notice_id,device_id,device_revision)
  SELECT NEW.id,d.id,d.revision FROM hoopcheck_push_private.devices d WHERE d.owner_id=NEW.user_id
  AND hoopcheck_push_private.eligible(NEW.id,d.id,d.revision) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER queue_private_chat_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION hoopcheck_push_private.queue_notice();
-- Authenticated clients may acknowledge, never rewrite a private notice into
-- a fabricated target/title/body. Ordinary existing notification updates stay.
CREATE FUNCTION hoopcheck_push_private.guard_notice() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
BEGIN
 IF current_user IN ('anon','authenticated') AND (OLD.target_type IN ('conversation','group_invite','group_discussion') OR NEW.target_type IN ('conversation','group_invite','group_discussion'))
 AND (to_jsonb(OLD)-'read_at') IS DISTINCT FROM (to_jsonb(NEW)-'read_at') THEN RAISE EXCEPTION 'Private notification is immutable' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER private_notice_immutable BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION hoopcheck_push_private.guard_notice();
CREATE FUNCTION public.claim_private_chat_push() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE q hoopcheck_push_private.deliveries%ROWTYPE; f uuid:=gen_random_uuid();
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT FROM hoopcheck_push_private.config WHERE singleton AND enabled) THEN RETURN jsonb_build_object('state','disabled');END IF;
 -- Ambiguous sends never retry automatically after a lease expires.
 UPDATE hoopcheck_push_private.deliveries SET state='uncertain',fence=NULL,lease_until=NULL WHERE state='leased' AND lease_until<=clock_timestamp();
 SELECT d.* INTO q FROM hoopcheck_push_private.deliveries d WHERE state IN ('queued','retry') AND attempts<3 AND next_attempt<=clock_timestamp()
 AND hoopcheck_push_private.eligible(d.notice_id,d.device_id,d.device_revision)
 ORDER BY next_attempt,notice_id,device_id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','idle');END IF;
 UPDATE hoopcheck_push_private.deliveries SET state='leased',fence=f,lease_until=clock_timestamp()+interval '1 minute',attempts=attempts+1 WHERE notice_id=q.notice_id AND device_id=q.device_id;
 RETURN jsonb_build_object('state','leased','notice_id',q.notice_id,'device_id',q.device_id,'fence',f);
END $f$;
CREATE FUNCTION public.resolve_private_chat_push(p_notice uuid,p_device uuid,p_fence uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE q hoopcheck_push_private.deliveries%ROWTYPE;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';END IF;
 SELECT * INTO q FROM hoopcheck_push_private.deliveries WHERE notice_id=p_notice AND device_id=p_device AND state='leased' AND fence=p_fence AND lease_until>clock_timestamp();
 IF NOT FOUND OR NOT hoopcheck_push_private.eligible(p_notice,p_device,q.device_revision) THEN RETURN NULL;END IF;
 RETURN (SELECT jsonb_build_object('token',token,'platform',platform) FROM hoopcheck_push_private.devices WHERE id=p_device AND revision=q.device_revision);
END $f$;
CREATE FUNCTION public.finish_private_chat_push(p_notice uuid,p_device uuid,p_fence uuid,p_outcome text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE q hoopcheck_push_private.deliveries%ROWTYPE; next_state text;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';END IF;
 IF p_outcome IS NULL OR p_outcome NOT IN ('sent','retry','invalid_token','uncertain','cancelled') THEN RAISE EXCEPTION 'Invalid outcome';END IF;
 SELECT * INTO q FROM hoopcheck_push_private.deliveries WHERE notice_id=p_notice AND device_id=p_device AND state='leased' AND fence=p_fence AND lease_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF p_outcome='invalid_token' THEN
  DELETE FROM hoopcheck_push_private.devices WHERE id=p_device AND revision=q.device_revision;
  IF FOUND THEN RETURN true;END IF;
 END IF;
 next_state:=CASE WHEN p_outcome='retry' AND q.attempts<3 AND hoopcheck_push_private.eligible(p_notice,p_device,q.device_revision) THEN 'retry' WHEN p_outcome IN ('sent','uncertain') THEN p_outcome ELSE 'cancelled' END;
 UPDATE hoopcheck_push_private.deliveries SET state=next_state,fence=NULL,lease_until=NULL,next_attempt=clock_timestamp()+interval '30 seconds' WHERE notice_id=p_notice AND device_id=p_device;
 RETURN true;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_push_private.active(),hoopcheck_push_private.session_valid(uuid,uuid),hoopcheck_push_private.preference(boolean),hoopcheck_push_private.device(uuid,text,text,boolean),hoopcheck_push_private.eligible(uuid,uuid,uuid),hoopcheck_push_private.queue_notice(),hoopcheck_push_private.guard_notice() FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA hoopcheck_push_private TO authenticated;
GRANT EXECUTE ON FUNCTION hoopcheck_push_private.preference(boolean),hoopcheck_push_private.device(uuid,text,text,boolean) TO authenticated;
CREATE FUNCTION public.my_chat_push_preference(p_enabled boolean DEFAULT NULL) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$ SELECT hoopcheck_push_private.preference(p_enabled) $f$;
CREATE FUNCTION public.my_chat_push_device(p_installation uuid,p_platform text DEFAULT NULL,p_token text DEFAULT NULL,p_revoke boolean DEFAULT false) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$ SELECT hoopcheck_push_private.device(p_installation,p_platform,p_token,p_revoke) $f$;
REVOKE ALL ON FUNCTION public.my_chat_push_preference(boolean),public.my_chat_push_device(uuid,text,text,boolean),public.claim_private_chat_push(),public.resolve_private_chat_push(uuid,uuid,uuid),public.finish_private_chat_push(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.my_chat_push_preference(boolean),public.my_chat_push_device(uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_private_chat_push(),public.resolve_private_chat_push(uuid,uuid,uuid),public.finish_private_chat_push(uuid,uuid,uuid,text) TO service_role;
COMMIT;
