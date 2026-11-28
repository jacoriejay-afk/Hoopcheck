-- REVIEW ONLY. Extend existing HoopGroups; do not apply to hosted databases.
-- Legacy public spaces and channels remain public. New management actions are
-- disabled by default. Privacy restrictions never disappear when disabled.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='25s';
DO $guard$ BEGIN
 IF to_regprocedure('public.confirm_active_account_session()') IS NULL OR to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NULL
 OR to_regclass('public.hoop_group_moderation_events') IS NULL
 OR (SELECT count(*) FROM pg_class WHERE oid IN ('public.hoop_group_spaces'::regclass,'public.hoop_group_channels'::regclass,'public.hoop_group_members'::regclass,'public.hoop_group_posts'::regclass) AND relrowsecurity)<>4
 THEN RAISE EXCEPTION 'Review existing group RLS and verified-session prerequisites'; END IF;
END $guard$;
ALTER TABLE public.hoop_group_spaces ADD COLUMN visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private'));
ALTER TABLE public.hoop_group_channels ADD COLUMN visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private'));
ALTER TABLE public.hoop_group_channels ADD CONSTRAINT group_access_channel_space_unique UNIQUE(space_id,id);
REVOKE INSERT(visibility),UPDATE(visibility) ON public.hoop_group_spaces,public.hoop_group_channels FROM PUBLIC,anon,authenticated;

CREATE SCHEMA hoopcheck_group_access;
REVOKE ALL ON SCHEMA hoopcheck_group_access FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA hoopcheck_group_access TO authenticated;
CREATE TABLE hoopcheck_group_access.config(singleton boolean PRIMARY KEY CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO hoopcheck_group_access.config VALUES(true,false);
CREATE TABLE hoopcheck_group_access.moderators(
 space_id uuid NOT NULL,user_id uuid NOT NULL,PRIMARY KEY(space_id,user_id),
 FOREIGN KEY(space_id,user_id) REFERENCES public.hoop_group_members(space_id,user_id) ON DELETE CASCADE);
CREATE TABLE hoopcheck_group_access.channel_grants(
 space_id uuid NOT NULL,channel_id uuid NOT NULL,user_id uuid NOT NULL,PRIMARY KEY(channel_id,user_id),
 FOREIGN KEY(space_id,channel_id) REFERENCES public.hoop_group_channels(space_id,id) ON DELETE CASCADE,
 FOREIGN KEY(space_id,user_id) REFERENCES public.hoop_group_members(space_id,user_id) ON DELETE CASCADE);
CREATE TABLE hoopcheck_group_access.bans(
 space_id uuid NOT NULL REFERENCES public.hoop_group_spaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,PRIMARY KEY(space_id,user_id));
CREATE TABLE hoopcheck_group_access.invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),space_id uuid NOT NULL REFERENCES public.hoop_group_spaces(id) ON DELETE CASCADE,
 invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','declined','revoked')),
 CHECK(inviter_id<>invitee_id));
CREATE UNIQUE INDEX group_pending_invite_unique ON hoopcheck_group_access.invitations(space_id,invitee_id) WHERE state='pending';
CREATE INDEX group_invite_inbox ON hoopcheck_group_access.invitations(invitee_id,state,expires_at);
CREATE INDEX group_channel_grant_member ON hoopcheck_group_access.channel_grants(space_id,user_id);
DO $acl$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['config','moderators','channel_grants','bans','invitations'] LOOP
 EXECUTE format('ALTER TABLE hoopcheck_group_access.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON hoopcheck_group_access.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $acl$;
CREATE FUNCTION hoopcheck_group_access.active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT auth.uid() IS NOT NULL AND public.confirm_active_account_session() IS TRUE AND hoopcheck_security.mfa_satisfied() IS TRUE
$f$;
CREATE FUNCTION hoopcheck_group_access.enabled() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT EXISTS(SELECT FROM hoopcheck_group_access.config WHERE singleton AND enabled)
$f$;
CREATE FUNCTION hoopcheck_group_access.bilateral_block(p_a uuid,p_b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT EXISTS(SELECT FROM public.user_blocks WHERE (blocker_id=p_a AND blocked_id=p_b) OR (blocker_id=p_b AND blocked_id=p_a))
 OR EXISTS(SELECT FROM public.hoop_group_blocks WHERE (blocker_id=p_a AND blocked_id=p_b) OR (blocker_id=p_b AND blocked_id=p_a))
$f$;
CREATE FUNCTION hoopcheck_group_access.contact(p_other uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT p_other<>auth.uid() AND NOT hoopcheck_group_access.bilateral_block(auth.uid(),p_other)
 AND EXISTS(SELECT FROM public.player_contact_requests r WHERE r.status='accepted' AND
 ((r.requester_id=auth.uid() AND r.player_id=p_other) OR (r.player_id=auth.uid() AND r.requester_id=p_other)))
$f$;
CREATE FUNCTION hoopcheck_group_access.see_space(p_space uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT hoopcheck_group_access.active() AND EXISTS(SELECT FROM public.hoop_group_spaces s WHERE s.id=p_space AND
 (s.visibility='public' OR s.owner_id=auth.uid() OR EXISTS(SELECT FROM public.hoop_group_members m WHERE m.space_id=s.id AND m.user_id=auth.uid())))
$f$;
CREATE FUNCTION hoopcheck_group_access.see_channel(p_channel uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT hoopcheck_group_access.active() AND EXISTS(SELECT FROM public.hoop_group_channels c JOIN public.hoop_group_spaces s ON s.id=c.space_id
 WHERE c.id=p_channel AND hoopcheck_group_access.see_space(s.id) AND
 (c.visibility='public' OR s.owner_id=auth.uid() OR EXISTS(SELECT FROM hoopcheck_group_access.channel_grants g WHERE g.channel_id=c.id AND g.user_id=auth.uid())))
$f$;
CREATE FUNCTION hoopcheck_group_access.join_public(p_space uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT hoopcheck_group_access.active() AND EXISTS(SELECT FROM public.hoop_group_spaces s WHERE s.id=p_space AND (s.visibility='public' OR s.owner_id=auth.uid()))
 AND NOT EXISTS(SELECT FROM hoopcheck_group_access.bans b WHERE b.space_id=p_space AND b.user_id=auth.uid())
$f$;
CREATE FUNCTION hoopcheck_group_access.leave_group(p_space uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT hoopcheck_group_access.active() AND EXISTS(SELECT FROM public.hoop_group_spaces s WHERE s.id=p_space AND
 (s.owner_id IS DISTINCT FROM auth.uid() OR (s.visibility='public' AND NOT hoopcheck_group_access.enabled())))
$f$;
CREATE FUNCTION hoopcheck_group_access.post_visible(p_channel uuid,p_author uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT hoopcheck_group_access.see_channel(p_channel) AND NOT hoopcheck_group_access.bilateral_block(auth.uid(),p_author)
 AND EXISTS(SELECT FROM public.hoop_group_channels c JOIN public.hoop_group_members m ON m.space_id=c.space_id
 WHERE c.id=p_channel AND m.user_id=auth.uid())
$f$;
CREATE FUNCTION hoopcheck_group_access.moderate_channel(p_channel uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT hoopcheck_group_access.see_channel(p_channel) AND EXISTS(SELECT FROM public.hoop_group_channels c JOIN public.hoop_group_spaces s ON s.id=c.space_id
 WHERE c.id=p_channel AND (s.owner_id=auth.uid() OR EXISTS(SELECT FROM hoopcheck_group_access.moderators m WHERE m.space_id=s.id AND m.user_id=auth.uid())))
$f$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hoopcheck_group_access FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_group_access.see_space(uuid),hoopcheck_group_access.see_channel(uuid),
 hoopcheck_group_access.join_public(uuid),hoopcheck_group_access.leave_group(uuid),hoopcheck_group_access.post_visible(uuid,uuid) TO authenticated;

-- Restrictive policies compose with all existing role, slow-mode, moderation
-- and session/freeze policies. No new broad permissive grant.
CREATE POLICY group_access_space_read ON public.hoop_group_spaces AS RESTRICTIVE FOR SELECT TO authenticated USING(hoopcheck_group_access.see_space(id));
CREATE POLICY group_access_channel_read ON public.hoop_group_channels AS RESTRICTIVE FOR SELECT TO authenticated USING(hoopcheck_group_access.see_channel(id));
CREATE POLICY group_access_public_space_insert ON public.hoop_group_spaces AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(visibility='public');
CREATE POLICY group_access_public_channel_insert ON public.hoop_group_channels AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(visibility='public');
CREATE POLICY group_access_member_join ON public.hoop_group_members AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(hoopcheck_group_access.join_public(space_id));
CREATE POLICY group_access_member_leave ON public.hoop_group_members AS RESTRICTIVE FOR DELETE TO authenticated USING(hoopcheck_group_access.leave_group(space_id));
CREATE POLICY group_access_post_read ON public.hoop_group_posts AS RESTRICTIVE FOR SELECT TO authenticated USING(hoopcheck_group_access.post_visible(channel_id,author_id));
CREATE POLICY group_access_post_write ON public.hoop_group_posts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(hoopcheck_group_access.post_visible(channel_id,author_id));
-- Existing read receipt and reply RPCs use post RLS, so private messages and
-- their unread state cannot be retrieved by a revoked member.

CREATE FUNCTION hoopcheck_group_access.snapshot(p_space uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE uid uuid:=auth.uid(); own boolean:=false; moderates boolean:=false; invitations jsonb; contacts jsonb:='[]'; members jsonb:='[]'; private_channels jsonb:='[]'; banned jsonb:='[]'; pending jsonb:='[]'; queue jsonb:='[]';
BEGIN
 IF NOT hoopcheck_group_access.active() OR NOT hoopcheck_group_access.enabled() THEN RAISE EXCEPTION 'Group access unavailable' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO invitations FROM (
 SELECT i.id,s.name AS group_name,i.expires_at FROM hoopcheck_group_access.invitations i JOIN public.hoop_group_spaces s ON s.id=i.space_id
 WHERE i.invitee_id=uid AND i.state='pending' AND i.expires_at>now() AND s.owner_id=i.inviter_id
 AND NOT hoopcheck_group_access.bilateral_block(uid,i.inviter_id)
 AND NOT EXISTS(SELECT FROM hoopcheck_group_access.bans b WHERE b.space_id=s.id AND b.user_id=uid)
 ORDER BY i.created_at DESC,i.id LIMIT 100) x;
 IF p_space IS NOT NULL AND hoopcheck_group_access.see_space(p_space) THEN
  SELECT coalesce(owner_id=uid,false) INTO own FROM public.hoop_group_spaces WHERE id=p_space;
  moderates:=own OR EXISTS(SELECT FROM hoopcheck_group_access.moderators WHERE space_id=p_space AND user_id=uid);
  IF own THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO members FROM (
    SELECT m.user_id,CASE WHEN p.profile_visibility='public' THEN coalesce(nullif(p.display_name,''),'HoopCheck member') ELSE 'HoopCheck member' END AS name,
    CASE WHEN m.user_id=uid THEN 'owner' WHEN mo.user_id IS NOT NULL THEN 'moderator' ELSE 'member' END AS role,
    coalesce((SELECT jsonb_agg(g.channel_id ORDER BY g.channel_id) FROM hoopcheck_group_access.channel_grants g WHERE g.space_id=p_space AND g.user_id=m.user_id),'[]') AS channels
    FROM public.hoop_group_members m LEFT JOIN public.profiles p ON p.id=m.user_id LEFT JOIN hoopcheck_group_access.moderators mo ON mo.space_id=m.space_id AND mo.user_id=m.user_id
    WHERE m.space_id=p_space ORDER BY (m.user_id=uid) DESC,m.joined_at,m.user_id LIMIT 100) x;
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO private_channels FROM (SELECT c.id,c.name FROM public.hoop_group_channels c WHERE c.space_id=p_space AND c.visibility='private' ORDER BY c.sort_index,c.id LIMIT 12) x;
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO contacts FROM (
    SELECT DISTINCT p.id,CASE WHEN p.profile_visibility='public' THEN coalesce(nullif(p.display_name,''),'HoopCheck contact') ELSE 'HoopCheck contact' END AS name
    FROM public.player_contact_requests r JOIN public.profiles p ON p.id=CASE WHEN r.requester_id=uid THEN r.player_id ELSE r.requester_id END
    WHERE r.status='accepted' AND uid IN(r.requester_id,r.player_id) AND hoopcheck_group_access.contact(p.id)
    AND NOT EXISTS(SELECT FROM public.hoop_group_members m WHERE m.space_id=p_space AND m.user_id=p.id)
    ORDER BY p.id LIMIT 100) x;
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO banned FROM (SELECT b.user_id,CASE WHEN p.profile_visibility='public' THEN coalesce(nullif(p.display_name,''),'HoopCheck member') ELSE 'HoopCheck member' END AS name FROM hoopcheck_group_access.bans b LEFT JOIN public.profiles p ON p.id=b.user_id WHERE b.space_id=p_space ORDER BY b.user_id LIMIT 100) x;
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO pending FROM (SELECT i.id,i.invitee_id,i.expires_at FROM hoopcheck_group_access.invitations i WHERE i.space_id=p_space AND i.state='pending' AND i.expires_at>now() ORDER BY i.created_at DESC LIMIT 100) x;
  END IF;
  IF moderates THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO queue FROM (
    SELECT p.id,p.channel_id,p.body,p.created_at FROM public.hoop_group_posts p JOIN public.hoop_group_channels c ON c.id=p.channel_id
    WHERE c.space_id=p_space AND p.moderation_status='pending' AND hoopcheck_group_access.moderate_channel(c.id)
    AND NOT hoopcheck_group_access.bilateral_block(uid,p.author_id) ORDER BY p.created_at,p.id LIMIT 100) x;
  END IF;
 END IF;
 IF NOT hoopcheck_group_access.active() THEN RAISE EXCEPTION 'Group access unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('space_id',p_space,'is_owner',own,'can_moderate',moderates,'invitations',invitations,'members',members,'contacts',contacts,'private_channels',private_channels,'banned',banned,'pending_invites',pending,'queue',queue);
END $f$;
CREATE FUNCTION hoopcheck_group_access.action(p_action text,p_space uuid,p_target uuid,p_channel uuid,p_name text,p_description text,p_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE uid uuid:=auth.uid(); s public.hoop_group_spaces%ROWTYPE; i hoopcheck_group_access.invitations%ROWTYPE; post public.hoop_group_posts%ROWTYPE; n text:=btrim(coalesce(p_name,'')); d text:=btrim(coalesce(p_description,'')); new_id uuid;
BEGIN
 IF NOT hoopcheck_group_access.active() OR NOT hoopcheck_group_access.enabled() THEN RAISE EXCEPTION 'Group access unavailable' USING ERRCODE='42501'; END IF;
 IF p_action='create_private_group' THEN
  IF p_target IS NULL OR char_length(n) NOT BETWEEN 3 AND 80 OR char_length(d)>300 THEN RAISE EXCEPTION 'Invalid group'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,7812));
  IF EXISTS(SELECT FROM public.hoop_group_spaces WHERE id=p_target AND owner_id=uid AND visibility='private' AND name=n AND description=d) THEN RETURN jsonb_build_object('ok',true,'id',p_target); END IF;
  IF (SELECT count(*) FROM public.hoop_group_spaces WHERE owner_id=uid)>=3 THEN RAISE EXCEPTION 'Group limit reached'; END IF;
  INSERT INTO public.hoop_group_spaces(id,slug,name,category,description,owner_id,visibility) VALUES(p_target,'private-'||replace(p_target::text,'-',''),n,'global',d,uid,'private');
  IF NOT EXISTS(SELECT FROM public.hoop_group_members WHERE space_id=p_target AND user_id=uid) THEN RAISE EXCEPTION 'Owner membership not confirmed'; END IF;
  RETURN jsonb_build_object('ok',true,'id',p_target);
 END IF;
 IF p_action IN ('accept_invite','decline_invite') THEN
  SELECT * INTO i FROM hoopcheck_group_access.invitations WHERE id=p_target AND invitee_id=uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.hoop_group_spaces WHERE id=i.space_id FOR UPDATE;
  SELECT * INTO i FROM hoopcheck_group_access.invitations WHERE id=p_target AND invitee_id=uid FOR UPDATE;
  IF NOT FOUND OR s.owner_id IS DISTINCT FROM i.inviter_id OR NOT hoopcheck_group_access.contact(i.inviter_id)
  OR EXISTS(SELECT FROM hoopcheck_group_access.bans b WHERE b.space_id=i.space_id AND b.user_id=uid) THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501'; END IF;
  IF p_action='accept_invite' AND i.state='accepted' AND EXISTS(SELECT FROM public.hoop_group_members WHERE space_id=i.space_id AND user_id=uid) THEN RETURN jsonb_build_object('ok',true,'id',i.space_id); END IF;
  IF p_action='decline_invite' AND i.state='declined' THEN RETURN jsonb_build_object('ok',true,'id',i.id); END IF;
  IF i.state<>'pending' OR i.expires_at<=now() THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501'; END IF;
  IF p_action='accept_invite' THEN
   INSERT INTO public.hoop_group_members(space_id,user_id) VALUES(i.space_id,uid) ON CONFLICT DO NOTHING;
   UPDATE hoopcheck_group_access.invitations SET state='accepted' WHERE id=i.id;
   RETURN jsonb_build_object('ok',true,'id',i.space_id);
  END IF;
  UPDATE hoopcheck_group_access.invitations SET state='declined' WHERE id=i.id;
  RETURN jsonb_build_object('ok',true,'id',i.id);
 END IF;
 SELECT * INTO s FROM public.hoop_group_spaces WHERE id=p_space FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Group unavailable' USING ERRCODE='42501'; END IF;
 IF p_action='moderate' THEN
  IF p_status IS NULL OR p_status NOT IN ('approved','rejected','removed') THEN RAISE EXCEPTION 'Invalid moderation'; END IF;
  SELECT p.* INTO post FROM public.hoop_group_posts p JOIN public.hoop_group_channels c ON c.id=p.channel_id WHERE p.id=p_target AND c.space_id=s.id FOR UPDATE OF p;
  IF NOT FOUND OR NOT hoopcheck_group_access.moderate_channel(post.channel_id) OR hoopcheck_group_access.bilateral_block(uid,post.author_id) THEN RAISE EXCEPTION 'Moderation unavailable' USING ERRCODE='42501'; END IF;
  IF post.moderation_status=p_status AND EXISTS(SELECT FROM public.hoop_group_moderation_events e WHERE e.post_id=post.id AND e.actor_id=uid AND e.to_status=p_status) THEN RETURN jsonb_build_object('ok',true,'id',post.id); END IF;
  IF NOT (post.moderation_status='pending' OR (post.moderation_status='approved' AND p_status='removed')) THEN RAISE EXCEPTION 'Invalid moderation transition'; END IF;
  UPDATE public.hoop_group_posts SET moderation_status=p_status WHERE id=post.id;
  INSERT INTO public.hoop_group_moderation_events(post_id,actor_id,from_status,to_status) VALUES(post.id,uid,post.moderation_status,p_status);
  RETURN jsonb_build_object('ok',true,'id',post.id);
 END IF;
 IF s.owner_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Group owner required' USING ERRCODE='42501'; END IF;
 IF p_action='create_private_channel' THEN
  IF p_target IS NULL OR char_length(n) NOT BETWEEN 2 AND 50 THEN RAISE EXCEPTION 'Invalid topic'; END IF;
  IF EXISTS(SELECT FROM public.hoop_group_channels WHERE id=p_target AND space_id=s.id AND name=n AND visibility='private') THEN RETURN jsonb_build_object('ok',true,'id',p_target); END IF;
  IF (SELECT count(*) FROM public.hoop_group_channels WHERE space_id=s.id)>=12 THEN RAISE EXCEPTION 'Topic limit reached'; END IF;
  INSERT INTO public.hoop_group_channels(id,space_id,slug,name,sort_index,visibility) VALUES(p_target,s.id,'private-'||replace(p_target::text,'-',''),n,(SELECT count(*)::smallint FROM public.hoop_group_channels WHERE space_id=s.id),'private');
  RETURN jsonb_build_object('ok',true,'id',p_target);
 END IF;
 IF p_action='invite' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,7813));
  IF p_target IS NULL OR NOT hoopcheck_group_access.contact(p_target) OR EXISTS(SELECT FROM public.hoop_group_members WHERE space_id=s.id AND user_id=p_target)
  OR EXISTS(SELECT FROM hoopcheck_group_access.bans WHERE space_id=s.id AND user_id=p_target) THEN RAISE EXCEPTION 'Contact unavailable' USING ERRCODE='42501'; END IF;
  UPDATE hoopcheck_group_access.invitations SET state='revoked' WHERE space_id=s.id AND invitee_id=p_target AND state='pending' AND expires_at<=now();
  SELECT id INTO new_id FROM hoopcheck_group_access.invitations WHERE space_id=s.id AND invitee_id=p_target AND state='pending';
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'id',new_id); END IF;
  IF (SELECT count(*) FROM hoopcheck_group_access.invitations WHERE inviter_id=uid AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Invitation limit reached'; END IF;
  INSERT INTO hoopcheck_group_access.invitations(space_id,invitee_id,inviter_id) VALUES(s.id,p_target,uid) RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok',true,'id',new_id);
 END IF;
 IF p_action='revoke_invite' THEN
  UPDATE hoopcheck_group_access.invitations SET state='revoked' WHERE id=p_target AND space_id=s.id AND state='pending';
  IF NOT EXISTS(SELECT FROM hoopcheck_group_access.invitations WHERE id=p_target AND space_id=s.id AND state='revoked') THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('ok',true,'id',p_target);
 END IF;
 IF p_target IS NULL OR p_target=uid THEN RAISE EXCEPTION 'Invalid member'; END IF;
 IF p_action='unban' THEN
  DELETE FROM hoopcheck_group_access.bans WHERE space_id=s.id AND user_id=p_target;
  RETURN jsonb_build_object('ok',true,'id',p_target);
 END IF;
 IF p_action IN ('remove_member','ban_member') THEN
  IF p_action='ban_member' THEN
   IF NOT EXISTS(SELECT FROM public.hoop_group_members WHERE space_id=s.id AND user_id=p_target) AND NOT EXISTS(SELECT FROM hoopcheck_group_access.bans WHERE space_id=s.id AND user_id=p_target) THEN RAISE EXCEPTION 'Member unavailable' USING ERRCODE='42501'; END IF;
   INSERT INTO hoopcheck_group_access.bans VALUES(s.id,p_target) ON CONFLICT DO NOTHING;
  END IF;
  DELETE FROM public.hoop_group_members WHERE space_id=s.id AND user_id=p_target;
  UPDATE hoopcheck_group_access.invitations SET state='revoked' WHERE space_id=s.id AND invitee_id=p_target AND state IN ('pending','accepted');
  RETURN jsonb_build_object('ok',true,'id',p_target);
 END IF;
 IF NOT EXISTS(SELECT FROM public.hoop_group_members WHERE space_id=s.id AND user_id=p_target) THEN RAISE EXCEPTION 'Member unavailable' USING ERRCODE='42501'; END IF;
 IF p_action='promote_moderator' THEN INSERT INTO hoopcheck_group_access.moderators VALUES(s.id,p_target) ON CONFLICT DO NOTHING;
 ELSIF p_action='remove_moderator' THEN DELETE FROM hoopcheck_group_access.moderators WHERE space_id=s.id AND user_id=p_target;
 ELSIF p_action IN ('grant_channel','revoke_channel') THEN
  IF NOT EXISTS(SELECT FROM public.hoop_group_channels WHERE id=p_channel AND space_id=s.id AND visibility='private') THEN RAISE EXCEPTION 'Private topic unavailable' USING ERRCODE='42501'; END IF;
  IF p_action='grant_channel' THEN INSERT INTO hoopcheck_group_access.channel_grants VALUES(s.id,p_channel,p_target) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM hoopcheck_group_access.channel_grants WHERE channel_id=p_channel AND space_id=s.id AND user_id=p_target; END IF;
 ELSE RAISE EXCEPTION 'Invalid group action'; END IF;
 RETURN jsonb_build_object('ok',true,'id',p_target);
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_group_access.snapshot(uuid),hoopcheck_group_access.action(text,uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_group_access.snapshot(uuid),hoopcheck_group_access.action(text,uuid,uuid,uuid,text,text,text) TO authenticated;
CREATE FUNCTION public.hoop_group_access_snapshot(p_space uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT hoopcheck_group_access.snapshot(p_space)
$f$;
CREATE FUNCTION public.hoop_group_access_action(p_action text,p_space uuid DEFAULT NULL,p_target uuid DEFAULT NULL,p_channel uuid DEFAULT NULL,p_name text DEFAULT NULL,p_description text DEFAULT NULL,p_status text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT hoopcheck_group_access.action(p_action,p_space,p_target,p_channel,p_name,p_description,p_status)
$f$;
REVOKE ALL ON FUNCTION public.hoop_group_access_snapshot(uuid),public.hoop_group_access_action(text,uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoop_group_access_snapshot(uuid),public.hoop_group_access_action(text,uuid,uuid,uuid,text,text,text) TO authenticated;
COMMIT;
