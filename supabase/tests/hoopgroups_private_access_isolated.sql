\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth; CREATE SCHEMA hoopcheck_security;
GRANT USAGE ON SCHEMA auth,hoopcheck_security TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.confirm_active_account_session() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('fixture.active',true)='yes' $$;
CREATE FUNCTION hoopcheck_security.mfa_satisfied() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('fixture.mfa',true)='yes' $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users,display_name text,profile_visibility text);
CREATE TABLE public.player_contact_requests(requester_id uuid,player_id uuid,status text);
CREATE TABLE public.user_blocks(blocker_id uuid,blocked_id uuid);
CREATE TABLE public.hoop_group_blocks(blocker_id uuid,blocked_id uuid);
CREATE TABLE public.hoop_group_spaces(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE,name text,category text,description text,owner_id uuid REFERENCES auth.users);
CREATE TABLE public.hoop_group_channels(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),space_id uuid REFERENCES public.hoop_group_spaces ON DELETE CASCADE,slug text,name text,sort_index smallint,UNIQUE(space_id,slug));
CREATE TABLE public.hoop_group_members(space_id uuid REFERENCES public.hoop_group_spaces ON DELETE CASCADE,user_id uuid REFERENCES auth.users,joined_at timestamptz DEFAULT now(),PRIMARY KEY(space_id,user_id));
CREATE TABLE public.hoop_group_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),channel_id uuid REFERENCES public.hoop_group_channels,author_id uuid REFERENCES auth.users,body text,moderation_status text DEFAULT 'pending',created_at timestamptz DEFAULT now());
CREATE TABLE public.hoop_group_moderation_events(post_id uuid,actor_id uuid,from_status text,to_status text);
CREATE FUNCTION public.fixture_owner_member() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO public.hoop_group_members(space_id,user_id) VALUES(NEW.id,NEW.owner_id); RETURN NEW; END $$;
CREATE TRIGGER fixture_owner_member AFTER INSERT ON public.hoop_group_spaces FOR EACH ROW EXECUTE FUNCTION public.fixture_owner_member();
ALTER TABLE public.hoop_group_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoop_group_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoop_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoop_group_posts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.hoop_group_spaces,public.hoop_group_channels,public.hoop_group_members,public.hoop_group_posts TO authenticated;
GRANT INSERT ON public.hoop_group_members,public.hoop_group_posts TO authenticated;
GRANT INSERT(id,slug,name,category,description,owner_id) ON public.hoop_group_spaces TO authenticated;
GRANT INSERT(id,space_id,slug,name,sort_index) ON public.hoop_group_channels TO authenticated;
GRANT DELETE ON public.hoop_group_members TO authenticated;
CREATE POLICY fixture_space_read ON public.hoop_group_spaces FOR SELECT TO authenticated USING(true);
CREATE POLICY fixture_channel_read ON public.hoop_group_channels FOR SELECT TO authenticated USING(true);
CREATE POLICY fixture_space_write ON public.hoop_group_spaces FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid());
CREATE POLICY fixture_channel_write ON public.hoop_group_channels FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT FROM public.hoop_group_spaces s WHERE s.id=space_id AND s.owner_id=auth.uid()));
CREATE POLICY fixture_member_read ON public.hoop_group_members FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY fixture_member_write ON public.hoop_group_members FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY fixture_member_delete ON public.hoop_group_members FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE POLICY fixture_post_read ON public.hoop_group_posts FOR SELECT TO authenticated USING(moderation_status='approved' OR author_id=auth.uid());
CREATE POLICY fixture_post_write ON public.hoop_group_posts FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid() AND moderation_status='pending');
INSERT INTO auth.users VALUES('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003');
INSERT INTO public.profiles SELECT id,'Fixture','public' FROM auth.users;
INSERT INTO public.player_contact_requests VALUES('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','accepted');
INSERT INTO public.hoop_group_spaces(id,slug,name,owner_id) VALUES('20000000-0000-4000-8000-000000000001','public','Public','10000000-0000-4000-8000-000000000001');
\ir ../candidates/hoopgroups_private_access_review_only.sql
SET fixture.active='yes'; SET fixture.mfa='yes';
SET ROLE authenticated;
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.hoop_group_spaces)<>1 THEN RAISE EXCEPTION 'legacy public space hidden'; END IF;
 BEGIN PERFORM public.hoop_group_access_snapshot(); RAISE EXCEPTION 'default-off bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE hoopcheck_group_access.config SET enabled=true;
SET ROLE authenticated;
SELECT public.hoop_group_access_action('create_private_group',p_target=>'20000000-0000-4000-8000-000000000002',p_name=>'Private group');
SELECT public.hoop_group_access_action('create_private_group',p_target=>'20000000-0000-4000-8000-000000000002',p_name=>'Private group');
SELECT public.hoop_group_access_action('create_private_channel','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',p_name=>'Private channel');
SELECT public.hoop_group_access_action('invite','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
 BEGIN PERFORM public.hoop_group_access_action('invite','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'); RAISE EXCEPTION 'unaccepted contact invited'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
INSERT INTO public.hoop_group_posts(id,channel_id,author_id,body) VALUES('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',auth.uid(),'fixture pending');
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
DO $$ DECLARE snap jsonb; inv uuid; BEGIN
 IF EXISTS(SELECT FROM public.hoop_group_spaces WHERE visibility='private') OR EXISTS(SELECT FROM public.hoop_group_channels) THEN RAISE EXCEPTION 'private metadata leaked'; END IF;
 BEGIN INSERT INTO public.hoop_group_members(space_id,user_id) VALUES('20000000-0000-4000-8000-000000000002',auth.uid()); RAISE EXCEPTION 'private join bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 snap:=public.hoop_group_access_snapshot(); inv:=(snap->'invitations'->0->>'id')::uuid;
 IF inv IS NULL THEN RAISE EXCEPTION 'invite missing'; END IF;
 PERFORM public.hoop_group_access_action('accept_invite',p_target=>inv);
 IF NOT EXISTS(SELECT FROM public.hoop_group_spaces WHERE visibility='private') OR EXISTS(SELECT FROM public.hoop_group_channels) THEN RAISE EXCEPTION 'member/channel separation failed'; END IF;
 BEGIN INSERT INTO public.hoop_group_posts(channel_id,author_id,body) VALUES('30000000-0000-4000-8000-000000000001',auth.uid(),'denied'); RAISE EXCEPTION 'private write bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
SELECT public.hoop_group_access_action('grant_channel','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');
SELECT public.hoop_group_access_action('promote_moderator','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
DO $$ BEGIN
 IF jsonb_array_length(public.hoop_group_access_snapshot('20000000-0000-4000-8000-000000000002')->'queue')<>1 THEN RAISE EXCEPTION 'moderation queue failed'; END IF;
 PERFORM public.hoop_group_access_action('moderate','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',p_status=>'approved');
 IF NOT EXISTS(SELECT FROM public.hoop_group_posts WHERE moderation_status='approved') THEN RAISE EXCEPTION 'approval failed'; END IF;
END $$;
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
SELECT public.hoop_group_access_action('revoke_channel','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
DO $$ BEGIN
 IF EXISTS(SELECT FROM public.hoop_group_channels) OR EXISTS(SELECT FROM public.hoop_group_posts) THEN RAISE EXCEPTION 'revocation leaked channel'; END IF;
END $$;
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
SELECT public.hoop_group_access_action('ban_member','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
DO $$ BEGIN
 IF EXISTS(SELECT FROM public.hoop_group_spaces WHERE visibility='private') THEN RAISE EXCEPTION 'banned member still sees private group'; END IF;
 BEGIN PERFORM * FROM hoopcheck_group_access.invitations; RAISE EXCEPTION 'private invite table accessible'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET fixture.mfa='no';
DO $$ BEGIN
 BEGIN PERFORM public.hoop_group_access_snapshot(); RAISE EXCEPTION 'MFA bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.hoop_group_moderation_events)<>1 OR EXISTS(SELECT FROM hoopcheck_group_access.moderators) OR EXISTS(SELECT FROM hoopcheck_group_access.channel_grants) THEN RAISE EXCEPTION 'audit/cascade failed'; END IF;
END $$;
SELECT 'PASS: synthetic private group, invite, channel grant, moderator, ban and MFA isolation' AS result;

\ir hoopgroups_member_page_isolated.sql

\ir hoopgroups_alerts_isolated.sql
