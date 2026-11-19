-- Execute the actual directory permission migration against synthetic functions.
\set ON_ERROR_STOP on
BEGIN;
DO $roles$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $roles$;
CREATE FUNCTION public.get_public_player_profile(uuid) RETURNS boolean
 LANGUAGE sql SECURITY INVOKER AS $fn$ SELECT true $fn$;
CREATE FUNCTION public.search_public_players(text,text,integer,integer) RETURNS boolean
 LANGUAGE sql SECURITY INVOKER AS $fn$ SELECT true $fn$;
CREATE FUNCTION public.search_public_players(text,text,text,boolean,integer) RETURNS boolean
 LANGUAGE sql SECURITY INVOKER AS $fn$ SELECT true $fn$;
CREATE FUNCTION public.search_public_players_page(text,text,text,boolean,integer,integer) RETURNS boolean
 LANGUAGE sql SECURITY INVOKER AS $fn$ SELECT true $fn$;
\i supabase/migrations/20261119170000_protected_player_directory_country.sql
DO $check$ BEGIN
 IF (SELECT count(*) FROM pg_proc
     WHERE oid IN (
       'public.get_public_player_profile(uuid)'::regprocedure,
       'public.search_public_players(text,text,integer,integer)'::regprocedure,
       'public.search_public_players(text,text,text,boolean,integer)'::regprocedure,
       'public.search_public_players_page(text,text,text,boolean,integer,integer)'::regprocedure
     ) AND prosecdef AND proconfig @> ARRAY['search_path=']) <> 4 THEN
  RAISE EXCEPTION 'one or more directory functions lack protected definer settings';
 END IF;
 IF NOT has_function_privilege('anon','public.search_public_players(text,text,integer,integer)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.search_public_players_page(text,text,text,boolean,integer,integer)','EXECUTE') THEN
  RAISE EXCEPTION 'public directory execution grants missing';
 END IF;
END $check$;
ROLLBACK;
SELECT 'PASS: actual directory permission migration applies to all four signatures' AS result;
