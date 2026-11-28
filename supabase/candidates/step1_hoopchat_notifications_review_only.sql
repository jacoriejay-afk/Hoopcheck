-- Review-only extension to the existing notification ledger and chat read
-- markers. No provider push, backfill, or live activation. Install only after
-- bilateral contact, active-session and MFA guards have been reviewed.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='20s';
DO $guard$ BEGIN
 IF to_regclass('hoopcheck_chat_private.read_markers') IS NULL
 OR to_regprocedure('public.confirm_active_account_session()') IS NULL
 OR to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NULL
 OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.player_contact_requests'::regclass AND polname='post16_contact_pair_block_guard' AND NOT polpermissive)
 OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.player_contact_messages'::regclass AND polname='post16_contact_message_block_guard' AND NOT polpermissive)
 OR NOT EXISTS(SELECT FROM pg_class WHERE oid='public.notifications'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Review notification and chat guard prerequisites'; END IF;
END $guard$;
-- Preserve all existing allowed values rather than replacing an evolving list.
DO $constraints$ DECLARE c record; BEGIN
 FOR c IN SELECT conname,pg_get_expr(conbin,conrelid) AS expression FROM pg_constraint
 WHERE conrelid='public.notifications'::regclass AND conname IN ('notifications_target_type_check','notifications_notification_type_check') AND contype='c' AND convalidated
 LOOP
  EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I',c.conname);
  EXECUTE format('ALTER TABLE public.notifications ADD CONSTRAINT %I CHECK ((%s) OR %s)',c.conname,c.expression,
   CASE c.conname WHEN 'notifications_target_type_check' THEN 'target_type = ''conversation''' ELSE 'notification_type = ''chat_message''' END);
 END LOOP;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.notifications'::regclass AND conname IN ('notifications_target_type_check','notifications_notification_type_check') AND contype='c' AND convalidated)<>2 THEN RAISE EXCEPTION 'Notification constraint drift'; END IF;
END $constraints$;
ALTER TABLE public.notifications ADD CONSTRAINT hoopchat_notification_pair_check
 CHECK ((target_type='conversation')=(notification_type='chat_message'));
CREATE TABLE hoopcheck_chat_private.notification_config(
 singleton boolean PRIMARY KEY CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO hoopcheck_chat_private.notification_config VALUES(true,false);
ALTER TABLE hoopcheck_chat_private.notification_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_chat_private.notification_config FROM PUBLIC,anon,authenticated,service_role;
-- Generic in-app event; ID equals persisted message ID for retry identity.
-- Never copy sender, draft, message body, reply content or contact name.
CREATE FUNCTION hoopcheck_chat_private.notify_confirmed_chat_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE peer uuid; requester uuid; player uuid;
BEGIN
 IF NOT EXISTS(SELECT FROM hoopcheck_chat_private.notification_config WHERE singleton AND enabled)
 OR auth.uid() IS DISTINCT FROM NEW.sender_id
 OR public.confirm_active_account_session() IS NOT TRUE OR hoopcheck_security.mfa_satisfied() IS NOT TRUE THEN RETURN NEW; END IF;
 SELECT requester_id,player_id INTO requester,player FROM public.player_contact_requests
 WHERE id=NEW.request_id AND status='accepted' AND NEW.sender_id IN (requester_id,player_id);
 IF NOT FOUND OR requester=player THEN RETURN NEW; END IF;
 peer:=CASE WHEN requester=NEW.sender_id THEN player ELSE requester END;
 IF EXISTS(SELECT FROM public.user_blocks WHERE (blocker_id=NEW.sender_id AND blocked_id=peer) OR (blocker_id=peer AND blocked_id=NEW.sender_id))
 THEN RETURN NEW; END IF;
 -- Recipient may have been removed already; the FK remains the last fence.
 IF NOT EXISTS(SELECT FROM public.profiles WHERE id=peer) THEN RETURN NEW; END IF;
 INSERT INTO public.notifications(id,user_id,target_type,target_id,notification_type,title,body,created_at)
 VALUES(NEW.id,peer,'conversation',NEW.request_id,'chat_message','New HoopChat message','Open HoopChat to view your private message.',clock_timestamp());
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_chat_private.notify_confirmed_chat_message() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER hoopchat_message_notification AFTER INSERT ON public.player_contact_messages
 FOR EACH ROW EXECUTE FUNCTION hoopcheck_chat_private.notify_confirmed_chat_message();
-- The existing caller-owned RLS still applies. This restrictive policy
-- additionally checks the source message, accepted relationship, and current
-- effective block/session/MFA guards, including for stale notification links.
CREATE POLICY hoopchat_notification_visibility ON public.notifications AS RESTRICTIVE FOR ALL TO authenticated
 USING (target_type<>'conversation' OR (
  user_id=(SELECT auth.uid()) AND (SELECT public.confirm_active_account_session()) AND (SELECT hoopcheck_security.mfa_satisfied())
  AND EXISTS(SELECT FROM public.player_contact_messages m JOIN public.player_contact_requests r ON r.id=m.request_id
   WHERE m.id=notifications.id AND m.request_id=notifications.target_id AND m.sender_id<>notifications.user_id AND r.status='accepted'
    AND notifications.user_id IN (r.requester_id,r.player_id))))
 WITH CHECK (target_type<>'conversation' OR (
  user_id=(SELECT auth.uid()) AND (SELECT public.confirm_active_account_session()) AND (SELECT hoopcheck_security.mfa_satisfied())
  AND EXISTS(SELECT FROM public.player_contact_messages m JOIN public.player_contact_requests r ON r.id=m.request_id
   WHERE m.id=notifications.id AND m.request_id=notifications.target_id AND m.sender_id<>notifications.user_id AND r.status='accepted'
    AND notifications.user_id IN (r.requester_id,r.player_id))));
CREATE INDEX hoopchat_notification_thread_read_idx ON public.notifications(user_id,target_id,id)
 WHERE target_type='conversation' AND notification_type='chat_message' AND read_at IS NULL;
-- Existing caller-scoped marker mutation also acknowledges its visible
-- conversation alerts. Opening an alert alone does not mark the thread read.
CREATE FUNCTION hoopcheck_chat_private.acknowledge_chat_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
BEGIN
 IF NEW.reader_id IS DISTINCT FROM auth.uid() OR public.confirm_active_account_session() IS NOT TRUE OR hoopcheck_security.mfa_satisfied() IS NOT TRUE
 THEN RAISE EXCEPTION 'Active reader required' USING ERRCODE='42501'; END IF;
 UPDATE public.notifications n SET read_at=clock_timestamp()
 FROM public.player_contact_messages m
 WHERE n.user_id=NEW.reader_id AND n.target_type='conversation' AND n.notification_type='chat_message' AND n.target_id=NEW.request_id AND n.read_at IS NULL
 AND m.id=n.id AND m.request_id=NEW.request_id AND m.sender_id<>NEW.reader_id AND (m.created_at,m.id)<=(NEW.last_read_at,NEW.last_read_id);
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_chat_private.acknowledge_chat_notifications() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER hoopchat_read_notification_ack AFTER INSERT OR UPDATE OF last_read_at,last_read_id ON hoopcheck_chat_private.read_markers
 FOR EACH ROW EXECUTE FUNCTION hoopcheck_chat_private.acknowledge_chat_notifications();
CREATE FUNCTION hoopcheck_chat_private.remove_deleted_message_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 DELETE FROM public.notifications WHERE id=OLD.id AND target_type='conversation' AND target_id=OLD.request_id AND notification_type='chat_message';
 RETURN OLD;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_chat_private.remove_deleted_message_alert() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER hoopchat_delete_message_alert AFTER DELETE ON public.player_contact_messages FOR EACH ROW EXECUTE FUNCTION hoopcheck_chat_private.remove_deleted_message_alert();
COMMIT;
