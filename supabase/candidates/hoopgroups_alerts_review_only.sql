-- Review-only. Requires the existing private access and notification ledger.
-- In-app only: no provider activation, no push token or private message preview.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='20s';
DO $guard$ BEGIN
 IF to_regclass('hoopcheck_group_access.invitations') IS NULL OR NOT EXISTS(SELECT FROM pg_class WHERE oid='public.notifications'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Review group and notification prerequisites'; END IF;
END $guard$;
DO $constraints$ DECLARE c record; BEGIN
 FOR c IN SELECT conname,pg_get_expr(conbin,conrelid) AS expression FROM pg_constraint WHERE conrelid='public.notifications'::regclass AND conname IN ('notifications_target_type_check','notifications_notification_type_check') AND contype='c' AND convalidated
 LOOP
  EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I',c.conname);
  EXECUTE format('ALTER TABLE public.notifications ADD CONSTRAINT %I CHECK ((%s) OR %s)',c.conname,c.expression,
  CASE c.conname WHEN 'notifications_target_type_check' THEN 'target_type IN (''group_invite'',''group_discussion'')' ELSE 'notification_type IN (''group_invitation'',''group_channel_message'')' END);
 END LOOP;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.notifications'::regclass AND conname IN ('notifications_target_type_check','notifications_notification_type_check') AND convalidated)<>2 THEN RAISE EXCEPTION 'Notification constraint drift'; END IF;
END $constraints$;
ALTER TABLE public.notifications ADD CONSTRAINT group_invite_notice_pair CHECK((target_type='group_invite')=(notification_type='group_invitation'));
ALTER TABLE public.notifications ADD CONSTRAINT group_discussion_notice_pair CHECK((target_type='group_discussion')=(notification_type='group_channel_message'));
CREATE TABLE hoopcheck_group_access.alert_config(singleton boolean PRIMARY KEY CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO hoopcheck_group_access.alert_config VALUES(true,false);
CREATE TABLE hoopcheck_group_access.alert_preferences(
 space_id uuid NOT NULL,user_id uuid NOT NULL,channel_id uuid,enabled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE NULLS NOT DISTINCT(space_id,user_id,channel_id),
 FOREIGN KEY(space_id,user_id) REFERENCES public.hoop_group_members(space_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(space_id,channel_id) REFERENCES public.hoop_group_channels(space_id,id) ON DELETE CASCADE);
CREATE TABLE hoopcheck_group_access.alert_events(
 post_id uuid PRIMARY KEY REFERENCES public.hoop_group_posts(id) ON DELETE CASCADE,
 channel_id uuid NOT NULL REFERENCES public.hoop_group_channels(id) ON DELETE CASCADE,
 approved_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX group_alert_event_channel_time ON hoopcheck_group_access.alert_events(channel_id,approved_at,post_id);
CREATE TABLE hoopcheck_group_access.alert_deliveries(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 post_id uuid NOT NULL REFERENCES hoopcheck_group_access.alert_events(post_id) ON DELETE CASCADE,
 notification_id uuid UNIQUE REFERENCES public.notifications(id) ON DELETE SET NULL,
 PRIMARY KEY(user_id,post_id));
DO $acl$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['alert_config','alert_preferences','alert_events','alert_deliveries'] LOOP
  EXECUTE format('ALTER TABLE hoopcheck_group_access.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON hoopcheck_group_access.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $acl$;
CREATE FUNCTION hoopcheck_group_access.alerts_enabled() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT hoopcheck_group_access.enabled() AND EXISTS(SELECT FROM hoopcheck_group_access.alert_config WHERE singleton AND enabled)
$f$;
CREATE FUNCTION hoopcheck_group_access.invitation_detail(p_invite uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT jsonb_build_object('id',i.id,'group_name',s.name,'expires_at',i.expires_at)
 FROM hoopcheck_group_access.invitations i JOIN public.hoop_group_spaces s ON s.id=i.space_id
 WHERE hoopcheck_group_access.active() AND hoopcheck_group_access.enabled() AND i.id=p_invite AND i.invitee_id=auth.uid()
 AND i.state='pending' AND i.expires_at>now() AND i.inviter_id=s.owner_id AND hoopcheck_group_access.contact(i.inviter_id)
 AND NOT EXISTS(SELECT FROM hoopcheck_group_access.bans b WHERE b.space_id=i.space_id AND b.user_id=i.invitee_id)
$f$;
CREATE FUNCTION hoopcheck_group_access.group_notice_visible(p_user uuid,p_kind text,p_target uuid,p_notice uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT hoopcheck_group_access.active() AND p_user=auth.uid() AND (
  (p_kind='group_invite' AND p_notice=p_target AND hoopcheck_group_access.invitation_detail(p_target) IS NOT NULL)
  OR (p_kind='group_discussion' AND EXISTS(SELECT FROM hoopcheck_group_access.alert_deliveries d JOIN public.hoop_group_posts p ON p.id=d.post_id
    WHERE d.user_id=p_user AND d.notification_id=p_notice AND p.channel_id=p_target AND p.moderation_status='approved'
      AND hoopcheck_group_access.post_visible(p.channel_id,p.author_id))))
$f$;
CREATE POLICY group_notice_visibility ON public.notifications AS RESTRICTIVE FOR ALL TO authenticated
 USING(target_type NOT IN ('group_invite','group_discussion') OR hoopcheck_group_access.group_notice_visible(user_id,target_type,target_id,id))
 WITH CHECK(target_type NOT IN ('group_invite','group_discussion') OR hoopcheck_group_access.group_notice_visible(user_id,target_type,target_id,id));
CREATE FUNCTION hoopcheck_group_access.invite_notice_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF TG_OP='DELETE' THEN DELETE FROM public.notifications WHERE id=OLD.id AND target_type='group_invite';RETURN OLD; END IF;
 IF NEW.state<>'pending' THEN DELETE FROM public.notifications WHERE id=NEW.id AND target_type='group_invite';RETURN NEW; END IF;
 IF TG_OP='INSERT' AND hoopcheck_group_access.alerts_enabled() THEN
  INSERT INTO public.notifications(id,user_id,target_type,target_id,notification_type,title,body,created_at)
  VALUES(NEW.id,NEW.invitee_id,'group_invite',NEW.id,'group_invitation','New HoopGroups invitation','Open HoopGroups to review your invitation.',clock_timestamp());
 END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER group_invite_notice AFTER INSERT OR UPDATE OF state OR DELETE ON hoopcheck_group_access.invitations FOR EACH ROW EXECUTE FUNCTION hoopcheck_group_access.invite_notice_trigger();
CREATE FUNCTION hoopcheck_group_access.post_alert_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF TG_OP='DELETE' THEN
  DELETE FROM public.notifications n USING hoopcheck_group_access.alert_deliveries d WHERE d.post_id=OLD.id AND d.notification_id=n.id AND n.target_type='group_discussion';RETURN OLD;
 END IF;
 IF NEW.moderation_status='approved' AND hoopcheck_group_access.alerts_enabled() THEN
  INSERT INTO hoopcheck_group_access.alert_events(post_id,channel_id) VALUES(NEW.id,NEW.channel_id) ON CONFLICT DO NOTHING;
 ELSIF NEW.moderation_status<>'approved' THEN
  DELETE FROM public.notifications n USING hoopcheck_group_access.alert_deliveries d WHERE d.post_id=NEW.id AND d.notification_id=n.id AND n.target_type='group_discussion';
 END IF;
 RETURN NEW;
END $f$;
-- BEFORE delete cleans alerts before cascading source rows are removed.
CREATE TRIGGER group_post_alert AFTER INSERT OR UPDATE OF moderation_status ON public.hoop_group_posts FOR EACH ROW EXECUTE FUNCTION hoopcheck_group_access.post_alert_trigger();
CREATE TRIGGER group_post_alert_delete BEFORE DELETE ON public.hoop_group_posts FOR EACH ROW EXECUTE FUNCTION hoopcheck_group_access.post_alert_trigger();
CREATE FUNCTION hoopcheck_group_access.alert_preference(p_space uuid,p_channel uuid,p_enabled boolean DEFAULT NULL)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF NOT hoopcheck_group_access.active() OR NOT hoopcheck_group_access.alerts_enabled()
 OR NOT EXISTS(SELECT FROM public.hoop_group_members WHERE space_id=p_space AND user_id=uid)
 OR NOT hoopcheck_group_access.see_space(p_space)
 OR (p_channel IS NOT NULL AND (NOT hoopcheck_group_access.see_channel(p_channel) OR NOT EXISTS(SELECT FROM public.hoop_group_channels WHERE id=p_channel AND space_id=p_space)))
 THEN RAISE EXCEPTION 'Group notification access unavailable' USING ERRCODE='42501'; END IF;
 IF p_enabled IS TRUE THEN INSERT INTO hoopcheck_group_access.alert_preferences(space_id,user_id,channel_id) VALUES(p_space,uid,p_channel) ON CONFLICT DO NOTHING;
 ELSIF p_enabled IS FALSE THEN DELETE FROM hoopcheck_group_access.alert_preferences WHERE space_id=p_space AND user_id=uid AND channel_id IS NOT DISTINCT FROM p_channel;
 END IF;
 RETURN EXISTS(SELECT FROM hoopcheck_group_access.alert_preferences WHERE space_id=p_space AND user_id=uid AND channel_id IS NOT DISTINCT FROM p_channel);
END $f$;
-- Pull-based bounded materialization. Runs only for the current verified
-- viewer when Alerts refreshes. Events before opt-in are not backfilled.
CREATE FUNCTION hoopcheck_group_access.refresh_alerts() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE uid uuid:=auth.uid(); event record; notice uuid; delivered integer:=0;
BEGIN
 IF NOT hoopcheck_group_access.active() THEN RAISE EXCEPTION 'Group notifications unavailable' USING ERRCODE='42501'; END IF;
 IF NOT hoopcheck_group_access.alerts_enabled() THEN RETURN 0; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,7814));
 FOR event IN SELECT e.post_id,e.channel_id,e.approved_at FROM hoopcheck_group_access.alert_events e
 JOIN public.hoop_group_posts p ON p.id=e.post_id JOIN public.hoop_group_channels c ON c.id=e.channel_id
 WHERE p.moderation_status='approved' AND p.author_id<>uid AND p.channel_id=e.channel_id
 AND e.approved_at>now()-interval '30 days'
 AND EXISTS(SELECT FROM hoopcheck_group_access.alert_preferences a WHERE a.user_id=uid AND a.space_id=c.space_id AND (a.channel_id IS NULL OR a.channel_id=c.id) AND a.enabled_at<=e.approved_at)
 AND NOT EXISTS(SELECT FROM hoopcheck_group_access.alert_deliveries d WHERE d.user_id=uid AND d.post_id=e.post_id)
 AND hoopcheck_group_access.post_visible(p.channel_id,p.author_id)
 ORDER BY e.approved_at,e.post_id LIMIT 100
 LOOP
  notice:=gen_random_uuid();
  INSERT INTO public.notifications(id,user_id,target_type,target_id,notification_type,title,body,created_at)
   VALUES(notice,uid,'group_discussion',event.channel_id,'group_channel_message','New HoopGroups discussion','Open HoopGroups to view the discussion.',event.approved_at);
  INSERT INTO hoopcheck_group_access.alert_deliveries(user_id,post_id,notification_id) VALUES(uid,event.post_id,notice);
  delivered:=delivered+1;
 END LOOP;
 RETURN delivered;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_group_access.alerts_enabled(),hoopcheck_group_access.invitation_detail(uuid),hoopcheck_group_access.group_notice_visible(uuid,text,uuid,uuid),hoopcheck_group_access.invite_notice_trigger(),hoopcheck_group_access.post_alert_trigger(),hoopcheck_group_access.alert_preference(uuid,uuid,boolean),hoopcheck_group_access.refresh_alerts() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_group_access.invitation_detail(uuid),hoopcheck_group_access.group_notice_visible(uuid,text,uuid,uuid),hoopcheck_group_access.alert_preference(uuid,uuid,boolean),hoopcheck_group_access.refresh_alerts() TO authenticated;
CREATE FUNCTION public.hoop_group_invitation_detail(p_invite uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$ SELECT hoopcheck_group_access.invitation_detail(p_invite) $f$;
CREATE FUNCTION public.hoop_group_alert_preference(p_space uuid,p_channel uuid DEFAULT NULL,p_enabled boolean DEFAULT NULL) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$ SELECT hoopcheck_group_access.alert_preference(p_space,p_channel,p_enabled) $f$;
CREATE FUNCTION public.refresh_my_hoop_group_alerts() RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$ SELECT hoopcheck_group_access.refresh_alerts() $f$;
REVOKE ALL ON FUNCTION public.hoop_group_invitation_detail(uuid),public.hoop_group_alert_preference(uuid,uuid,boolean),public.refresh_my_hoop_group_alerts() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoop_group_invitation_detail(uuid),public.hoop_group_alert_preference(uuid,uuid,boolean),public.refresh_my_hoop_group_alerts() TO authenticated;
COMMIT;
