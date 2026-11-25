\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database()<>'hoopcheck_scouting_notes_test' THEN RAISE EXCEPTION 'Disposable database only'; END IF;
END $$;
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, account_type text, moderation_status text);
INSERT INTO public.profiles VALUES
 ('00000000-0000-0000-0000-000000000001','agent','normal'),
 ('00000000-0000-0000-0000-000000000002','scout','normal'),
 ('00000000-0000-0000-0000-000000000003','player','normal'),
 ('00000000-0000-0000-0000-000000000004','scout','suspended');
\ir ../candidates/build16_private_scouting_notes_review_only.sql
DO $$ BEGIN
 IF has_table_privilege('anon','public.private_scouting_notes','SELECT')
 OR has_table_privilege('service_role','public.private_scouting_notes','SELECT')
 OR has_column_privilege('authenticated','public.private_scouting_notes','owner_id','UPDATE')
 OR has_column_privilege('authenticated','public.private_scouting_notes','owner_id','INSERT')
 OR has_column_privilege('authenticated','public.private_scouting_notes','created_at','UPDATE')
 OR has_function_privilege('anon','hoopcheck_scouting_internal.can_write_notes()','EXECUTE')
 THEN RAISE EXCEPTION 'Excess privileges'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
INSERT INTO public.private_scouting_notes(subject,body) VALUES('Fixture prospect','Private fixture one');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
INSERT INTO public.private_scouting_notes(subject,body) VALUES('Fixture game','Private fixture two');
DO $$ DECLARE n integer; BEGIN
 IF (SELECT count(*) FROM public.private_scouting_notes)<>1 THEN RAISE EXCEPTION 'Cross-account read'; END IF;
 UPDATE public.private_scouting_notes SET body='Unauthorized edit' WHERE owner_id='00000000-0000-0000-0000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Cross-account update'; END IF;
 DELETE FROM public.private_scouting_notes WHERE owner_id='00000000-0000-0000-0000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Cross-account delete'; END IF;
 UPDATE public.private_scouting_notes SET body='Own edit';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Own edit failed'; END IF;
 BEGIN
 INSERT INTO public.private_scouting_notes(owner_id,subject,body) VALUES('00000000-0000-0000-0000-000000000001','Spoof','Spoof');
 RAISE EXCEPTION 'Owner spoof succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 INSERT INTO public.private_scouting_notes(subject,body) VALUES(' ','Blank');
 RAISE EXCEPTION 'Blank note accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
 INSERT INTO public.private_scouting_notes(subject,body) VALUES('Long',repeat('a',2001));
 RAISE EXCEPTION 'Oversized note accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
DO $$ DECLARE actor text; BEGIN
 FOREACH actor IN ARRAY ARRAY['','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004'] LOOP
 PERFORM set_config('request.jwt.claim.sub',actor,true);
 IF EXISTS(SELECT 1 FROM public.private_scouting_notes) THEN RAISE EXCEPTION 'Unauthorized notes read'; END IF;
 BEGIN INSERT INTO public.private_scouting_notes(subject,body) VALUES('Denied','Denied');
 RAISE EXCEPTION 'Unauthorized note created'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.jwt.claims','{"is_anonymous":true}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.private_scouting_notes) THEN RAISE EXCEPTION 'Anonymous Auth session sees notes'; END IF;
 BEGIN INSERT INTO public.private_scouting_notes(subject,body) VALUES('Denied','Denied');
 RAISE EXCEPTION 'Anonymous Auth write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{}',true);
RESET ROLE;
UPDATE public.profiles SET account_type='player' WHERE id='00000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
 IF (SELECT count(*) FROM public.private_scouting_notes)<>1 THEN RAISE EXCEPTION 'Former professional cannot read own data'; END IF;
 UPDATE public.private_scouting_notes SET body='Denied';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Former professional can edit'; END IF;
 DELETE FROM public.private_scouting_notes;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Former professional cannot delete own data'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.private_scouting_notes)<>1 THEN RAISE EXCEPTION 'Unexpected rows'; END IF;
END $$;
DELETE FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.private_scouting_notes) THEN RAISE EXCEPTION 'Account deletion did not cascade'; END IF;
END $$;
ROLLBACK;
