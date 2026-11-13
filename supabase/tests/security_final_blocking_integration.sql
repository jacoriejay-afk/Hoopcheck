\set ON_ERROR_STOP on
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.follow_relationships(follower_id uuid NOT NULL, target_type text NOT NULL, target_id uuid NOT NULL);
INSERT INTO auth.users(id) VALUES
('11111111-1111-1111-1111-111111111111'),
('22222222-2222-2222-2222-222222222222'),
('33333333-3333-3333-3333-333333333333');
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.follow_relationships TO authenticated;
ALTER TABLE public.follow_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_follow_owner ON public.follow_relationships TO authenticated USING (follower_id=auth.uid()) WITH CHECK (follower_id=auth.uid());
\i docs/security/security-final-user-blocking-candidate.sql
DO $$
BEGIN
 IF has_table_privilege('anon','public.user_blocks','SELECT') THEN RAISE EXCEPTION 'anon can read blocks'; END IF;
 IF has_function_privilege('anon','public.security_final_lock_user_pair(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'anon can invoke lock helper'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
INSERT INTO public.follow_relationships VALUES ('11111111-1111-1111-1111-111111111111','player','22222222-2222-2222-2222-222222222222');
INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.follow_relationships) THEN RAISE EXCEPTION 'block did not remove follow'; END IF;
 BEGIN
  INSERT INTO public.follow_relationships VALUES ('11111111-1111-1111-1111-111111111111','player','22222222-2222-2222-2222-222222222222');
  RAISE EXCEPTION 'blocked follow allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.user_blocks VALUES ('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');
  RAISE EXCEPTION 'forged block allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.user_blocks VALUES ('11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111');
  RAISE EXCEPTION 'self block allowed';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
DELETE FROM public.user_blocks WHERE blocker_id='11111111-1111-1111-1111-111111111111';
INSERT INTO public.follow_relationships VALUES ('11111111-1111-1111-1111-111111111111','player','22222222-2222-2222-2222-222222222222');
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
INSERT INTO public.user_blocks VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111');
DO $$
BEGIN
 BEGIN
  INSERT INTO public.follow_relationships VALUES ('22222222-2222-2222-2222-222222222222','player','11111111-1111-1111-1111-111111111111');
  RAISE EXCEPTION 'reverse block allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
