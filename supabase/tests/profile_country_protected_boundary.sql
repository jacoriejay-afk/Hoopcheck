-- Isolated security-boundary PROTOTYPE. No production schema changes.
-- A restricted base column plus owner-only RPC is a candidate, not the selected release migration.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, profile_visibility text,
 display_name text, current_country text, current_country_public boolean);
INSERT INTO public.profiles VALUES
 ('11111111-1111-4111-8111-111111111111','public','Private Player','SECRET FIXTURE',false),
 ('22222222-2222-4222-8222-222222222222','public','Public Player','PUBLIC FIXTURE',true);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_read ON public.profiles FOR SELECT TO anon
 USING (profile_visibility='public');
CREATE POLICY authenticated_read ON public.profiles FOR SELECT TO authenticated
 USING (profile_visibility='public' OR id=auth.uid());
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT(id,profile_visibility,display_name,current_country_public) ON public.profiles TO anon,authenticated;
GRANT UPDATE(display_name,current_country,current_country_public) ON public.profiles TO authenticated;
CREATE POLICY owner_update ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK (id=auth.uid());
-- Base country column is NOT granted to either client role.
CREATE OR REPLACE FUNCTION public.read_own_private_country(p_id uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.current_country FROM public.profiles p
 WHERE p.id=p_id AND p.id=(SELECT auth.uid())
$$;
REVOKE ALL ON FUNCTION public.read_own_private_country(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_own_private_country(uuid) TO authenticated;
-- Public RPC returns only safe projection, even for a row whose country is private.
CREATE OR REPLACE FUNCTION public.read_public_country(p_id uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p.current_country_public IS TRUE THEN p.current_country ELSE NULL END
 FROM public.profiles p
 WHERE p.id=p_id AND p.profile_visibility='public'
$$;
REVOKE ALL ON FUNCTION public.read_public_country(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_public_country(uuid) TO anon,authenticated;
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF has_column_privilege('anon','public.profiles','current_country','SELECT') THEN
  RAISE EXCEPTION 'anonymous direct country SELECT unexpectedly granted';
 END IF;
 IF (SELECT public.read_public_country('11111111-1111-4111-8111-111111111111')) IS NOT NULL THEN
  RAISE EXCEPTION 'public RPC leaked private country';
 END IF;
 IF (SELECT public.read_public_country('22222222-2222-4222-8222-222222222222')) <> 'PUBLIC FIXTURE' THEN
  RAISE EXCEPTION 'public country missing';
 END IF;
 -- Verify that direct SQL cannot reveal the protected country even on a public profile.
 BEGIN
  EXECUTE 'SELECT current_country FROM public.profiles LIMIT 1';
  RAISE EXCEPTION 'anonymous raw country SELECT unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF has_function_privilege('anon','public.read_own_private_country(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'anonymous role can execute owner-only RPC';
 END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF has_column_privilege('authenticated','public.profiles','current_country','SELECT') THEN
  RAISE EXCEPTION 'authenticated direct country SELECT unexpectedly granted';
 END IF;
 BEGIN
  EXECUTE 'SELECT current_country FROM public.profiles LIMIT 1';
  RAISE EXCEPTION 'authenticated raw country SELECT unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF (SELECT public.read_own_private_country('11111111-1111-4111-8111-111111111111')) <> 'SECRET FIXTURE' THEN
  RAISE EXCEPTION 'owner cannot read own private country';
 END IF;
 -- Owner edits must use safe RETURNING fields and then refresh the private value through the owner RPC.
 UPDATE public.profiles SET current_country='UPDATED SECRET FIXTURE' WHERE id='11111111-1111-4111-8111-111111111111';
 IF (SELECT public.read_own_private_country('11111111-1111-4111-8111-111111111111')) <> 'UPDATED SECRET FIXTURE' THEN
  RAISE EXCEPTION 'owner country edit or protected refresh failed';
 END IF;
 -- Owner must not be able to edit another user's private country through the table.
 UPDATE public.profiles SET current_country='UNAUTHORIZED CHANGE' WHERE id='22222222-2222-4222-8222-222222222222';
 IF FOUND THEN RAISE EXCEPTION 'owner could update another user country'; END IF;
 IF (SELECT public.read_own_private_country('22222222-2222-4222-8222-222222222222')) IS NOT NULL THEN
  RAISE EXCEPTION 'owner-only RPC leaks another user country';
 END IF;
END $$;
-- Verify UPDATE ... RETURNING can use a non-sensitive projection after country SELECT is revoked.
UPDATE public.profiles SET display_name='Edited Player' WHERE id='11111111-1111-4111-8111-111111111111' RETURNING id,display_name;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: candidate restricted-column/owner-RPC privacy boundary with synthetic data' AS result;
