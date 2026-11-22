-- Phase 1 hotfix: preserve all three legacy RPC signatures, defaults, owners,
-- grants, RLS and client-facing result columns; mask opted-out current_country
-- in RESULTS AND SEARCH PREDICATES, plus unapproved avatar URLs.
-- No table/role/column grant changes; Phase 2 direct raw SELECT restriction
-- remains blocked on installed-client compatibility and real JWT acceptance.
-- Apply only to the verified production project after exact-head tests.
-- Run via an atomic transactional migration executor (Supabase apply_migration)
-- or psql --single-transaction; do not execute statements individually.
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '25s';
DO $guard$
DECLARE drift text;
BEGIN
 IF to_regclass('public.profiles') IS NULL OR
    NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.profiles'::regclass) OR
    NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='current_country_public' AND NOT attisdropped) OR
    NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='avatar_moderation_status' AND NOT attisdropped)
 THEN
   RAISE EXCEPTION 'Unexpected profiles schema or disabled RLS — abort privacy hotfix';
 END IF;
 SELECT string_agg(e.signature, ', ' ORDER BY e.signature) INTO drift
 FROM (VALUES
  ('public.get_public_player_profile(uuid)','5d7ea9682e0f549b359888c019a657bb'),
  ('public.search_public_players(text,text,text,boolean,integer)','378505e5bc40299370a991d17058a095'),
  ('public.search_public_players_page(text,text,text,boolean,integer,integer)','0b35b8188a6a26fb457b6cca1295a93e')
 ) e(signature, baseline_md5)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 WHERE p.oid IS NULL
    OR md5(p.prosrc) IS DISTINCT FROM e.baseline_md5
    OR pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres'
    OR p.prosecdef IS DISTINCT FROM false
    OR p.provolatile IS DISTINCT FROM 's'
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
    OR NOT has_function_privilege('anon',p.oid,'EXECUTE')
    OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE');
 IF drift IS NOT NULL THEN
    RAISE EXCEPTION 'Production RPC catalog drift detected: %; no changes applied',drift;
 END IF;
END $guard$;
-- BEGIN THREE MASKED LEGACY RPC DEFINITIONS
create or replace function public.get_public_player_profile(p_user_id uuid)
returns table(
  id uuid,
  display_name text,
  avatar_url text,
  country text,
  bio text,
  player_position text,
  years_pro integer,
  current_country text,
  current_team text,
  player_verified boolean,
  player_verified_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    case
      when coalesce(p.avatar_moderation_status, 'approved') = 'approved' then p.avatar_url
      else null
    end,
    p.country,
    p.bio,
    p.position,
    p.years_pro,
    case when p.id = auth.uid() or p.current_country_public is true then p.current_country else null end,
    p.current_team,
    p.player_verified,
    p.player_verified_at
  from public.profiles p
  where p.id = p_user_id
    and p.account_type = 'player'
    and (
      p.profile_visibility = 'public'
      or (
        p.profile_visibility = 'players_only'
        and exists (
          select 1 from public.profiles viewer
          where viewer.id = auth.uid() and viewer.account_type = 'player'
        )
      )
    )
    and (p.moderation_status is null or p.moderation_status <> 'suspended');
$$;


CREATE OR REPLACE FUNCTION public.search_public_players(
  p_query text DEFAULT ''::text,
  p_country text DEFAULT ''::text,
  p_position text DEFAULT ''::text,
  p_verified_only boolean DEFAULT false,
  p_limit integer DEFAULT 24
)
RETURNS TABLE(
  id uuid, display_name text, avatar_url text, country text, bio text,
  player_position text, years_pro integer, current_country text,
  current_team text, player_verified boolean, player_verified_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT p.id, p.display_name,
    CASE WHEN coalesce(p.avatar_moderation_status, 'approved') = 'approved'
      THEN p.avatar_url ELSE NULL END,
    p.country, p.bio, p.position, p.years_pro,
    CASE WHEN p.current_country_public IS TRUE THEN p.current_country ELSE NULL END,
    p.current_team, p.player_verified, p.player_verified_at
  FROM public.profiles p
  WHERE p.profile_visibility = 'public'
    AND p.account_type = 'player'
    AND coalesce(p.moderation_status, 'active') <> 'suspended'
    AND coalesce(p.basketball_type, 'mens') = 'mens'
    AND (
      nullif(trim(p_query), '') IS NULL
      OR p.display_name ILIKE '%' || trim(p_query) || '%'
      OR p.username ILIKE '%' || trim(p_query) || '%'
      OR p.country ILIKE '%' || trim(p_query) || '%'
      OR (p.current_country_public IS TRUE AND p.current_country ILIKE '%' || trim(p_query) || '%')
      OR p.current_team ILIKE '%' || trim(p_query) || '%'
      OR p.position ILIKE '%' || trim(p_query) || '%'
    )
    AND (nullif(trim(p_country), '') IS NULL OR p.country = trim(p_country)
      OR (p.current_country_public IS TRUE AND p.current_country = trim(p_country)))
    AND (nullif(trim(p_position), '') IS NULL OR p.position = trim(p_position))
    AND (coalesce(p_verified_only, false) = false OR p.player_verified = true)
  ORDER BY p.player_verified DESC, p.display_name ASC
  LIMIT least(greatest(coalesce(p_limit, 24), 1), 50);
$$;
-- CREATE OR REPLACE retains the legacy function's existing grants.


-- Main website search uses this separate paginated RPC. Preserve its full
-- existing signature, defaults and ordering while masking private locations.
CREATE OR REPLACE FUNCTION public.search_public_players_page(
  p_query text DEFAULT ''::text,
  p_country text DEFAULT ''::text,
  p_position text DEFAULT ''::text,
  p_verified_only boolean DEFAULT false,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, display_name text, avatar_url text, country text, bio text,
  player_position text, years_pro integer, current_country text,
  current_team text, player_verified boolean, player_verified_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT p.id, p.display_name,
    CASE WHEN coalesce(p.avatar_moderation_status, 'approved') = 'approved'
      THEN p.avatar_url ELSE NULL END,
    p.country, p.bio, p.position, p.years_pro,
    CASE WHEN p.current_country_public IS TRUE THEN p.current_country ELSE NULL END,
    p.current_team, p.player_verified, p.player_verified_at
  FROM public.profiles p
  WHERE p.profile_visibility = 'public'
    AND p.account_type = 'player'
    AND coalesce(p.moderation_status, 'active') <> 'suspended'
    AND coalesce(p.basketball_type, 'mens') = 'mens'
    AND (
      nullif(trim(p_query), '') IS NULL
      OR p.display_name ILIKE '%' || trim(p_query) || '%'
      OR p.username ILIKE '%' || trim(p_query) || '%'
      OR p.country ILIKE '%' || trim(p_query) || '%'
      OR (p.current_country_public IS TRUE AND p.current_country ILIKE '%' || trim(p_query) || '%')
      OR p.current_team ILIKE '%' || trim(p_query) || '%'
      OR p.position ILIKE '%' || trim(p_query) || '%'
    )
    AND (nullif(trim(p_country), '') IS NULL OR p.country = trim(p_country)
      OR (p.current_country_public IS TRUE AND p.current_country = trim(p_country)))
    AND (nullif(trim(p_position), '') IS NULL OR p.position = trim(p_position))
    AND (coalesce(p_verified_only, false) = false OR p.player_verified = true)
  ORDER BY p.player_verified DESC, p.display_name ASC, p.id
  LIMIT least(greatest(coalesce(p_limit, 24), 1), 50)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

-- END THREE MASKED LEGACY RPC DEFINITIONS
DO $verify$
DECLARE damaged text;
BEGIN
 SELECT string_agg(e.signature,', ' ORDER BY e.signature) INTO damaged
 FROM (VALUES
  ('public.get_public_player_profile(uuid)'),
  ('public.search_public_players(text,text,text,boolean,integer)'),
  ('public.search_public_players_page(text,text,text,boolean,integer,integer)')
 ) e(signature)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 WHERE p.oid IS NULL OR pg_get_userbyid(p.proowner) IS DISTINCT FROM 'postgres'
 OR p.prosecdef IS DISTINCT FROM false OR p.provolatile IS DISTINCT FROM 's'
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
 OR NOT has_function_privilege('anon',p.oid,'EXECUTE')
 OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 OR position('current_country_public' IN p.prosrc)=0;
 IF damaged IS NOT NULL THEN RAISE EXCEPTION 'Post-migration RPC contract failed: %',damaged; END IF;
END $verify$;
NOTIFY pgrst, 'reload schema';
