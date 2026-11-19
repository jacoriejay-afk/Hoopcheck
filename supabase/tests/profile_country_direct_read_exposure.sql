-- Reproduces #737 against SYNTHETIC records in a disposable PostgreSQL database.
-- DO NOT run against production: this script creates roles, functions, and a public.profiles fixture.
-- The assertions intentionally PASS when the CURRENT vulnerability is reproduced.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;
CREATE TABLE public.profiles (
 id uuid PRIMARY KEY, account_type text, profile_visibility text,
 current_country text, current_country_public boolean
);
INSERT INTO public.profiles VALUES
 ('11111111-1111-4111-8111-111111111111','player','public','PRIVATE FIXTURE COUNTRY',false),
 ('22222222-2222-4222-8222-222222222222','player','public','PUBLIC FIXTURE COUNTRY',true),
 ('33333333-3333-4333-8333-333333333333','player','private','PRIVATE ROW COUNTRY',false);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_public_read ON public.profiles FOR SELECT TO anon
 USING (profile_visibility='public');
CREATE POLICY profiles_authenticated_read ON public.profiles FOR SELECT TO authenticated
 USING (profile_visibility='public' OR id=auth.uid());
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
-- Simulate production's column grants, not table-wide SELECT.
GRANT SELECT(id,account_type,profile_visibility,current_country,current_country_public)
 ON public.profiles TO anon,authenticated;
DO $$ BEGIN
 IF has_table_privilege('anon','public.profiles','SELECT') THEN
  RAISE EXCEPTION 'fixture must not grant table-wide SELECT';
 END IF;
 IF NOT has_column_privilege('anon','public.profiles','current_country','SELECT') THEN
  RAISE EXCEPTION 'fixture must grant current_country column SELECT';
 END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF (SELECT current_country FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111')
    IS DISTINCT FROM 'PRIVATE FIXTURE COUNTRY' THEN
  RAISE EXCEPTION 'expected anonymous direct-read exposure not reproduced';
 END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id='33333333-3333-4333-8333-333333333333') THEN
  RAISE EXCEPTION 'private row leaked in fixture';
 END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
 IF (SELECT current_country FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111')
    IS DISTINCT FROM 'PRIVATE FIXTURE COUNTRY' THEN
  RAISE EXCEPTION 'expected authenticated direct-read exposure not reproduced';
 END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: reproduced direct hidden-country exposure in synthetic RLS/column-grant fixture; all fixture rows rolled back' AS result;
