\set ON_ERROR_STOP on
-- Disposable PostgreSQL database only. Never point this test at a real project.
DO $$ BEGIN
  IF current_database() <> 'hoopcheck_follower_removal_test' THEN
    RAISE EXCEPTION 'Use a disposable follower-removal test database';
  END IF;
END $$;
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, account_type text, moderation_status text);
CREATE TABLE public.follow_relationships(
 follower_id uuid NOT NULL REFERENCES public.profiles(id),
 target_type text NOT NULL, target_id uuid NOT NULL,
 PRIMARY KEY(follower_id,target_type,target_id)
);
ALTER TABLE public.follow_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followers manage own" ON public.follow_relationships
 FOR ALL TO authenticated USING(auth.uid()=follower_id) WITH CHECK(auth.uid()=follower_id);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.follow_relationships TO authenticated;
INSERT INTO public.profiles VALUES
 ('00000000-0000-0000-0000-000000000001','player','normal'),
 ('00000000-0000-0000-0000-000000000002','fan','normal'),
 ('00000000-0000-0000-0000-000000000003','player','normal'),
 ('00000000-0000-0000-0000-000000000004','agent','normal'),
 ('00000000-0000-0000-0000-000000000005','player','suspended');
INSERT INTO public.follow_relationships VALUES
 ('00000000-0000-0000-0000-000000000002','player','00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000003','player','00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002','player','00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-000000000002','team','00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000001','fan','00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000002','player','00000000-0000-0000-0000-000000000005');
\ir ../candidates/build16_follower_removal_review_only.sql
DO $$ BEGIN
 IF has_function_privilege('anon','public.remove_own_follower(uuid)','EXECUTE')
 OR has_function_privilege('anon','hoopcheck_follower_internal.remove_own_follower(uuid)','EXECUTE')
 OR has_function_privilege('service_role','public.remove_own_follower(uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.remove_own_follower(uuid)','EXECUTE')
 OR (SELECT prosecdef FROM pg_proc WHERE oid='public.remove_own_follower(uuid)'::regprocedure)
 THEN RAISE EXCEPTION 'Unexpected RPC privileges'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$ DECLARE n integer; BEGIN
 DELETE FROM public.follow_relationships WHERE follower_id='00000000-0000-0000-0000-000000000002';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Direct inbound deletion became possible'; END IF;
 PERFORM public.remove_own_follower('00000000-0000-0000-0000-000000000002');
 PERFORM public.remove_own_follower('00000000-0000-0000-0000-000000000002');
 BEGIN
  PERFORM public.remove_own_follower('00000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'Self target accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"is_anonymous":true}',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.remove_own_follower('00000000-0000-0000-0000-000000000003');
  RAISE EXCEPTION 'Anonymous Auth session accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{}',true);
DO $$ DECLARE actor text; BEGIN
 FOREACH actor IN ARRAY ARRAY['','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005'] LOOP
  PERFORM set_config('request.jwt.claim.sub',actor,true);
  BEGIN
   PERFORM public.remove_own_follower('00000000-0000-0000-0000-000000000002');
   RAISE EXCEPTION 'Unqualified actor accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT public.remove_own_follower('00000000-0000-0000-0000-000000000001');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.follow_relationships) <> 4
 OR EXISTS(SELECT 1 FROM public.follow_relationships WHERE follower_id='00000000-0000-0000-0000-000000000002' AND target_id='00000000-0000-0000-0000-000000000001' AND target_type='player')
 OR NOT EXISTS(SELECT 1 FROM public.follow_relationships WHERE follower_id='00000000-0000-0000-0000-000000000002' AND target_id='00000000-0000-0000-0000-000000000003' AND target_type='player')
 OR NOT EXISTS(SELECT 1 FROM public.follow_relationships WHERE follower_id='00000000-0000-0000-0000-000000000002' AND target_id='00000000-0000-0000-0000-000000000001' AND target_type='team')
 OR NOT EXISTS(SELECT 1 FROM public.follow_relationships WHERE follower_id='00000000-0000-0000-0000-000000000003' AND target_id='00000000-0000-0000-0000-000000000001' AND target_type='player')
 OR NOT EXISTS(SELECT 1 FROM public.follow_relationships WHERE follower_id='00000000-0000-0000-0000-000000000002' AND target_id='00000000-0000-0000-0000-000000000005' AND target_type='player')
 THEN RAISE EXCEPTION 'Follower action changed unrelated records'; END IF;
END $$;
ROLLBACK;
