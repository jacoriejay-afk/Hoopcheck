-- Synthetic only; prior group private access/roster fixture provides all participants.
CREATE TABLE public.notifications(id uuid PRIMARY KEY,user_id uuid NOT NULL,target_type text NOT NULL,target_id uuid NOT NULL,notification_type text NOT NULL,title text NOT NULL,body text NOT NULL,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT notifications_target_type_check CHECK(target_type IN ('team','game','conversation')),
 CONSTRAINT notifications_notification_type_check CHECK(notification_type IN ('review','chat_message')),
 CONSTRAINT hoopchat_notification_pair_check CHECK((target_type='conversation')=(notification_type='chat_message')));
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT,UPDATE(read_at) ON public.notifications TO authenticated;
CREATE POLICY fixture_own_alert ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY fixture_own_alert_update ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
\ir ../candidates/hoopgroups_alerts_review_only.sql
SET fixture.active='yes';SET fixture.mfa='yes';SET ROLE authenticated;SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
SELECT public.hoop_group_access_action('unban','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
SELECT public.hoop_group_access_action('invite','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
RESET ROLE;
DO $$BEGIN IF EXISTS(SELECT FROM public.notifications) THEN RAISE EXCEPTION 'Default-off notice emitted'; END IF; END$$;
UPDATE hoopcheck_group_access.alert_config SET enabled=true;
UPDATE hoopcheck_group_access.invitations SET state='revoked' WHERE state='pending';
SET ROLE authenticated;SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
SELECT public.hoop_group_access_action('invite','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
DO $$BEGIN IF EXISTS(SELECT FROM public.notifications) THEN RAISE EXCEPTION 'Sender received invite alert'; END IF;END$$;
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
DO $$DECLARE inv uuid; BEGIN
 SELECT target_id INTO inv FROM public.notifications WHERE target_type='group_invite';
 IF inv IS NULL OR public.hoop_group_invitation_detail(inv) IS NULL THEN RAISE EXCEPTION 'Invite deep link unavailable'; END IF;
 PERFORM public.hoop_group_access_action('accept_invite',p_target=>inv);
 IF EXISTS(SELECT FROM public.notifications WHERE target_type='group_invite') OR public.hoop_group_invitation_detail(inv) IS NOT NULL THEN RAISE EXCEPTION 'Used invite remained visible'; END IF;
 IF NOT public.hoop_group_alert_preference('20000000-0000-4000-8000-000000000002',NULL,true) THEN RAISE EXCEPTION 'Community opt-in failed'; END IF;
 BEGIN PERFORM public.hoop_group_alert_preference('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',true);RAISE EXCEPTION 'Private channel opt-in bypass';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END$$;
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
SELECT public.hoop_group_access_action('grant_channel','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');
INSERT INTO public.hoop_group_posts(id,channel_id,author_id,body) VALUES('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',auth.uid(),'sensitive body never copied');
SELECT public.hoop_group_access_action('moderate','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',p_status=>'approved');
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
DO $$BEGIN
 IF public.refresh_my_hoop_group_alerts()<>1 OR public.refresh_my_hoop_group_alerts()<>0 THEN RAISE EXCEPTION 'Notice materialization retry failed'; END IF;
 IF (SELECT count(*) FROM public.notifications WHERE target_type='group_discussion')<>1 OR EXISTS(SELECT FROM public.notifications WHERE body LIKE '%sensitive body%') THEN RAISE EXCEPTION 'Discussion notification content or scope incorrect'; END IF;
END$$;
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
SELECT public.hoop_group_access_action('revoke_channel','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
DO $$BEGIN IF EXISTS(SELECT FROM public.notifications) OR public.refresh_my_hoop_group_alerts()<>0 THEN RAISE EXCEPTION 'Revoked channel alert leaked'; END IF; END$$;
RESET ROLE;
DELETE FROM public.hoop_group_posts WHERE id='40000000-0000-4000-8000-000000000002';
DO $$BEGIN IF EXISTS(SELECT FROM public.notifications WHERE target_type='group_discussion') THEN RAISE EXCEPTION 'Source deletion left alert'; END IF;END$$;
SELECT 'PASS group invite alerts, opt-in discussion alerts, idempotent materialization and permission revocation';
