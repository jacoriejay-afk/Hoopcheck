-- REVIEW ONLY. DO NOT APPLY TO PRODUCTION. Requires independently reviewed PG17 baseline.
-- Apply atomically only after confirming effective accepted-participant RLS and both-direction block policies.
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='4s';
DO $guard$
DECLARE t oid:=to_regclass('public.player_contact_messages');
BEGIN
 IF t IS NULL OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid=t)
 OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=t AND polname='accepted participants can view messages' AND polcmd='r')
 OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=t AND polname='accepted participants can send messages' AND polcmd='a')
 OR has_table_privilege('anon',t,'SELECT') OR has_table_privilege('anon',t,'INSERT')
 THEN RAISE EXCEPTION 'HoopChat reply baseline drift'; END IF;
END $guard$;
ALTER TABLE public.player_contact_messages ADD COLUMN reply_to_id uuid;
ALTER TABLE public.player_contact_messages ADD CONSTRAINT player_contact_messages_thread_id_unique UNIQUE(request_id,id);
ALTER TABLE public.player_contact_messages ADD CONSTRAINT player_contact_messages_reply_same_thread
 FOREIGN KEY(request_id,reply_to_id) REFERENCES public.player_contact_messages(request_id,id)
 ON DELETE SET NULL (reply_to_id);
ALTER TABLE public.player_contact_messages ADD CONSTRAINT player_contact_messages_reply_not_self CHECK(reply_to_id IS NULL OR reply_to_id<>id);
CREATE FUNCTION public.validate_hoopchat_reply() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id AND NEW.reply_to_id IS NOT NULL THEN
      RAISE EXCEPTION 'Reply links are immutable';
   END IF;
   RETURN NEW;
 END IF;
 IF NEW.reply_to_id IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM public.player_contact_messages m WHERE m.id=NEW.reply_to_id AND m.request_id=NEW.request_id
 ) THEN RAISE EXCEPTION 'Reply target unavailable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_hoopchat_reply BEFORE INSERT OR UPDATE ON public.player_contact_messages
 FOR EACH ROW EXECUTE FUNCTION public.validate_hoopchat_reply();
-- No grants, no new RLS policy, no cross-thread forwarding and no copied private payload.
-- Older clients omit the nullable column. Deleting an original clears its link.
