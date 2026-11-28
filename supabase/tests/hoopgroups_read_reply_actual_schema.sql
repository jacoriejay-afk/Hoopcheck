-- Supplemental actual-schema test body. The companion runner opens a single
-- rollback-only transaction and inserts the review candidates before this file.
-- NEVER execute on a hosted database or with actual account records.
INSERT INTO auth.users(id,email,encrypted_password,email_confirmed_at,aud,role,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
VALUES
 ('a1111111-1111-4111-8111-111111111111','group-accept-a@example.invalid','fixture',now(),'authenticated','authenticated',now(),now(),'{"provider":"email"}','{"account_type":"player","gender":"male","birthdate":"1990-01-01","username":"group_accept_a","position":"PG","years_pro":"5","professional_experience":"true","agreed_to_terms":"true","terms_accepted_at":"2026-11-28T00:00:00Z","terms_version":"1","full_name":"Group Acceptance A"}'),
 ('b2222222-2222-4222-8222-222222222222','group-accept-b@example.invalid','fixture',now(),'authenticated','authenticated',now(),now(),'{"provider":"email"}','{"account_type":"player","gender":"male","birthdate":"1990-01-01","username":"group_accept_b","position":"PG","years_pro":"5","professional_experience":"true","agreed_to_terms":"true","terms_accepted_at":"2026-11-28T00:00:00Z","terms_version":"1","full_name":"Group Acceptance B"}');
INSERT INTO auth.sessions(id,user_id,created_at,updated_at,aal)
VALUES ('a3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111',now(),now(),'aal1'),
 ('b4444444-4444-4444-8444-444444444444','b2222222-2222-4222-8222-222222222222',now(),now(),'aal1');
INSERT INTO public.hoop_group_spaces(id,slug,name,category,description)
 VALUES('c1111111-1111-4111-8111-111111111111','qa-actual-group','QA actual group','global','Disposable');
INSERT INTO public.hoop_group_channels(id,space_id,slug,name)
 VALUES('c2222222-2222-4222-8222-222222222222','c1111111-1111-4111-8111-111111111111','general','General'),
 ('c3333333-3333-4333-8333-333333333333','c1111111-1111-4111-8111-111111111111','other','Other');
INSERT INTO public.hoop_group_members(space_id,user_id)
 VALUES('c1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111'),
 ('c1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222');
INSERT INTO public.hoop_group_posts(id,channel_id,author_id,body,moderation_status,created_at,posting_slot)
 VALUES('d1111111-1111-4111-8111-111111111111','c2222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222','Approved parent','approved',now()-interval '3 minutes',floor(extract(epoch from now()-interval '3 minutes')/20)::bigint),
 ('d2222222-2222-4222-8222-222222222222','c2222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222','Pending parent','pending',now()-interval '2 minutes',floor(extract(epoch from now()-interval '2 minutes')/20)::bigint);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1","session_id":"a3333333-3333-4333-8333-333333333333","is_anonymous":false}',true);
SELECT set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
DO $$
DECLARE n bigint;
BEGIN
 IF public.confirm_active_account_session() IS DISTINCT FROM true THEN RAISE EXCEPTION 'Actual session guard not satisfied'; END IF;
 SELECT unread_count INTO n FROM public.hoop_group_unread_counts('c1111111-1111-4111-8111-111111111111') WHERE channel_id='c2222222-2222-4222-8222-222222222222';
 IF n IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Approved/unapproved unread mismatch: %',n; END IF;
 RAISE NOTICE 'PASS: actual group unread excludes pending messages';
 IF public.mark_hoop_group_posts_read('c2222222-2222-4222-8222-222222222222',ARRAY['d1111111-1111-4111-8111-111111111111','d2222222-2222-4222-8222-222222222222']::uuid[]) IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Receipt write scope mismatch'; END IF;
 IF public.mark_hoop_group_posts_read('c2222222-2222-4222-8222-222222222222',ARRAY['d1111111-1111-4111-8111-111111111111']::uuid[]) IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Receipt retry not idempotent'; END IF;
 SELECT unread_count INTO n FROM public.hoop_group_unread_counts('c1111111-1111-4111-8111-111111111111') WHERE channel_id='c2222222-2222-4222-8222-222222222222';
 IF n IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Read state not persistent'; END IF;
 RAISE NOTICE 'PASS: actual durable receipt and duplicate protection';
 BEGIN
 INSERT INTO public.hoop_group_post_reads(user_id,post_id) VALUES('b2222222-2222-4222-8222-222222222222','d1111111-1111-4111-8111-111111111111');
 RAISE EXCEPTION 'Foreign receipt unexpectedly accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS: foreign read receipt denied';
 BEGIN
 INSERT INTO public.hoop_group_posts(id,channel_id,author_id,body,reply_to_id) VALUES('e1111111-1111-4111-8111-111111111111','c3333333-3333-4333-8333-333333333333',auth.uid(),'Wrong channel','d1111111-1111-4111-8111-111111111111');
 RAISE EXCEPTION 'Cross-channel reply unexpectedly accepted';
 EXCEPTION WHEN insufficient_privilege OR foreign_key_violation THEN NULL; END;
 BEGIN
 INSERT INTO public.hoop_group_posts(id,channel_id,author_id,body,reply_to_id) VALUES('e1111111-1111-4111-8111-111111111111','c2222222-2222-4222-8222-222222222222',auth.uid(),'Hidden parent','d2222222-2222-4222-8222-222222222222');
 RAISE EXCEPTION 'Pending parent unexpectedly accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS: cross-channel and unapproved parents denied';
 INSERT INTO public.hoop_group_posts(id,channel_id,author_id,body,reply_to_id) VALUES('e1111111-1111-4111-8111-111111111111','c2222222-2222-4222-8222-222222222222',auth.uid(),'Valid reply','d1111111-1111-4111-8111-111111111111');
 IF NOT EXISTS(SELECT 1 FROM public.hoop_group_posts WHERE id='e1111111-1111-4111-8111-111111111111' AND moderation_status='pending' AND was_reply AND reply_to_id='d1111111-1111-4111-8111-111111111111') THEN RAISE EXCEPTION 'Valid reply not persisted'; END IF;
 RAISE NOTICE 'PASS: valid structured reply remains pending';
END $$;
RESET ROLE;
UPDATE public.hoop_group_posts SET moderation_status='approved' WHERE id='d2222222-2222-4222-8222-222222222222';
SET LOCAL ROLE authenticated;
DO $$ DECLARE n bigint; BEGIN
 SELECT unread_count INTO n FROM public.hoop_group_unread_counts('c1111111-1111-4111-8111-111111111111') WHERE channel_id='c2222222-2222-4222-8222-222222222222';
 IF n IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Late moderation not unread'; END IF;
 RAISE NOTICE 'PASS: late approval is unread';
END $$;
RESET ROLE;
DELETE FROM public.hoop_group_posts WHERE id='d1111111-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.hoop_group_posts WHERE id='e1111111-1111-4111-8111-111111111111' AND was_reply AND reply_to_id IS NULL) THEN RAISE EXCEPTION 'Deleted parent tombstone missing'; END IF;
 RAISE NOTICE 'PASS: deleted parent leaves safe unavailable reference';
END $$;
DELETE FROM public.hoop_group_members WHERE space_id='c1111111-1111-4111-8111-111111111111' AND user_id='a1111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
 PERFORM public.hoop_group_unread_counts('c1111111-1111-4111-8111-111111111111');
 RAISE EXCEPTION 'Revoked membership still reads counts';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 PERFORM public.mark_hoop_group_posts_read('c2222222-2222-4222-8222-222222222222',ARRAY['d2222222-2222-4222-8222-222222222222']::uuid[]);
 RAISE EXCEPTION 'Revoked membership still marks reads';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS: revoked membership cannot read or mark group';
END $$;
RESET ROLE;
