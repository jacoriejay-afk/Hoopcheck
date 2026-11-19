-- Isolated regression: masking a column in SECURITY INVOKER SQL does not
-- bypass column privileges. A future protected directory RPC must address this.
\set ON_ERROR_STOP on
BEGIN;
DO $fixture$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $fixture$;
CREATE TABLE public.profiles (
 id integer PRIMARY KEY, display_name text,
 current_country text, current_country_public boolean
);
INSERT INTO public.profiles VALUES (1,'Private player','SECRET',false),(2,'Public player','VISIBLE',true);
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT(id,display_name,current_country_public) ON public.profiles TO anon,authenticated;
CREATE FUNCTION public.directory_country_masked()
RETURNS TABLE(id integer, current_country text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $fn$
 SELECT p.id, CASE WHEN p.current_country_public IS TRUE THEN p.current_country ELSE NULL END
 FROM public.profiles p ORDER BY p.id
$fn$;
REVOKE ALL ON FUNCTION public.directory_country_masked() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directory_country_masked() TO anon,authenticated;
SET LOCAL ROLE anon;
DO $check$ BEGIN
 IF has_column_privilege('anon','public.profiles','current_country','SELECT') THEN
  RAISE EXCEPTION 'raw country must not be readable';
 END IF;
 BEGIN
  PERFORM * FROM public.directory_country_masked();
  RAISE EXCEPTION 'SECURITY INVOKER unexpectedly read a revoked column';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $check$;
SET LOCAL ROLE authenticated;
DO $check$ BEGIN
 BEGIN
  PERFORM * FROM public.directory_country_masked();
  RAISE EXCEPTION 'authenticated SECURITY INVOKER unexpectedly read a revoked column';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $check$;
-- Candidate protected directory boundary: keep raw column revoked while returning
-- only public values. This is a synthetic prototype, not the production RPC.
RESET ROLE;
CREATE FUNCTION public.directory_country_protected()
RETURNS TABLE(id integer, current_country text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $protected$
 SELECT p.id,
   CASE WHEN p.current_country_public IS TRUE THEN p.current_country ELSE NULL END
 FROM public.profiles p ORDER BY p.id
$protected$;
REVOKE ALL ON FUNCTION public.directory_country_protected() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directory_country_protected() TO anon,authenticated;
SET LOCAL ROLE anon;
DO $check$ BEGIN
 IF (SELECT current_country FROM public.directory_country_protected() WHERE id=1) IS NOT NULL THEN
  RAISE EXCEPTION 'protected directory disclosed private country to anonymous';
 END IF;
 IF (SELECT current_country FROM public.directory_country_protected() WHERE id=2) IS DISTINCT FROM 'VISIBLE' THEN
  RAISE EXCEPTION 'protected directory suppressed public country';
 END IF;
END $check$;
SET LOCAL ROLE authenticated;
DO $check$ BEGIN
 IF (SELECT current_country FROM public.directory_country_protected() WHERE id=1) IS NOT NULL THEN
  RAISE EXCEPTION 'protected directory disclosed private country to authenticated';
 END IF;
 IF (SELECT current_country FROM public.directory_country_protected() WHERE id=2) IS DISTINCT FROM 'VISIBLE' THEN
  RAISE EXCEPTION 'protected directory suppressed public country for authenticated';
 END IF;
END $check$;
ROLLBACK;
SELECT 'PASS: column revoke breaks masked invoker RPC; directory release needs protected implementation' AS result;
