-- Synthetic extension of the original unread fixture, before its rollback.
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.user_blocks(blocker_id uuid,blocked_id uuid,PRIMARY KEY(blocker_id,blocked_id));
CREATE TABLE public.notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,target_type text NOT NULL,target_id uuid NOT NULL,notification_type text NOT NULL,title text NOT NULL,body text NOT NULL,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT notifications_target_type_check CHECK(target_type IN ('team','coach','league','game')),
 CONSTRAINT notifications_notification_type_check CHECK(notification_type IN ('review','rating','update','game_reminder','group_request','group_approved','group_report')));
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT,UPDATE(read_at) ON public.notifications TO authenticated;
-- Test the review-only SQL inside this fixture transaction, without commits.
\ir ../candidates/step1_hoopchat_notifications_review_only.sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
SET LOCAL fixture.session='active';
SET LOCAL fixture.mfa='verified';
SET LOCAL fixture.blocked_request='';
INSERT INTO public.player_contact_messages(id,request_id,sender_id,body) VALUES('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','22222222-2222-4222-8222-222222222222','disabled fixture');
RESET ROLE;
DO $$BEGIN IF EXISTS(SELECT FROM public.notifications WHERE target_type='conversation') THEN RAISE EXCEPTION 'Default-off notification emitted'; END IF; END$$;
UPDATE hoopcheck_chat_private.notification_config SET enabled=true;
SET LOCAL ROLE authenticated;
INSERT INTO public.player_contact_messages(id,request_id,sender_id,body) VALUES('cccccccc-cccc-4ccc-8ccc-ccccccccccc2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','22222222-2222-4222-8222-222222222222','private fixture message');
DO $$BEGIN IF EXISTS(SELECT FROM public.notifications WHERE target_type='conversation') THEN RAISE EXCEPTION 'Sender sees recipient alert'; END IF; END$$;
SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $$BEGIN
 IF (SELECT count(*) FROM public.notifications WHERE target_type='conversation' AND id='cccccccc-cccc-4ccc-8ccc-ccccccccccc2' AND read_at IS NULL)<>1 OR EXISTS(SELECT FROM public.notifications WHERE body LIKE '%private fixture message%') THEN RAISE EXCEPTION 'Recipient alert or content protection failed'; END IF;
 IF NOT public.mark_hoopchat_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','cccccccc-cccc-4ccc-8ccc-ccccccccccc2') THEN RAISE EXCEPTION 'Read acknowledgement missing'; END IF;
 IF NOT EXISTS(SELECT FROM public.notifications WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc2' AND read_at IS NOT NULL) THEN RAISE EXCEPTION 'Chat read did not acknowledge alert'; END IF;
END$$;
SET LOCAL fixture.blocked_request='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
DO $$BEGIN IF EXISTS(SELECT FROM public.notifications WHERE target_type='conversation') THEN RAISE EXCEPTION 'Blocked alert visible'; END IF; END$$;
SET LOCAL fixture.blocked_request='';
SET LOCAL fixture.session='revoked';
DO $$BEGIN IF EXISTS(SELECT FROM public.notifications WHERE target_type='conversation') THEN RAISE EXCEPTION 'Revoked alert visible'; END IF; END$$;
SET LOCAL fixture.session='active';
SET LOCAL request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $$BEGIN IF EXISTS(SELECT FROM public.notifications WHERE target_type='conversation') THEN RAISE EXCEPTION 'Foreign alert visible'; END IF; END$$;
RESET ROLE;
DELETE FROM public.player_contact_messages WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
DO $$BEGIN IF EXISTS(SELECT FROM public.notifications WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc2') THEN RAISE EXCEPTION 'Deleted source alert retained'; END IF; END$$;
SELECT 'PASS synthetic chat alert privacy, owner read sync, default off, block, revoked session and source cleanup';
