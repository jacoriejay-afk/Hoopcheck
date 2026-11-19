-- Candidate migration only: tested in isolation; do not apply to production during Build 8 preparation.
-- Public profiles stay public. Players-only profiles are exposed through this RPC only to authenticated player accounts.
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

-- A shared read path keeps private location and moderated avatars out of web and
-- native directory responses. INVOKER preserves the existing table RLS boundary.
create or replace function public.search_public_players(
  p_username text, p_country text default null, p_limit integer default 30, p_offset integer default 0
)
returns table(id uuid, display_name text, username text, country text,
  current_country text, current_team text, "position" text, years_pro integer,
  free_agent boolean, avatar_url text, player_verified boolean, basketball_type text)
language sql stable security invoker set search_path = public
as $$
  select p.id, p.display_name, p.username, p.country,
    case when p.current_country_public is true then p.current_country else null end,
    p.current_team, p.position, p.years_pro, p.free_agent,
    case when coalesce(p.avatar_moderation_status, 'approved') = 'approved' then p.avatar_url else null end,
    p.player_verified, p.basketball_type
  from public.profiles p
  where p.account_type = 'player' and p.profile_visibility = 'public'
    and coalesce(p.moderation_status, 'normal') <> 'suspended'
    and char_length(ltrim(btrim(p_username), '@')) between 2 and 100
    and strpos(lower(p.username), lower(ltrim(btrim(p_username), '@'))) > 0
    and not exists (select 1 from public.profiles viewer where viewer.id = auth.uid() and viewer.account_type = 'fan')
    and (p_country is null or char_length(btrim(p_country)) <= 120)
    and (nullif(btrim(p_country), '') is null or
      (p.current_country_public is true and strpos(lower(p.current_country), lower(btrim(p_country))) > 0))
  order by lower(p.username), p.id
  limit greatest(1, least(coalesce(p_limit, 30), 101))
  offset greatest(0, least(coalesce(p_offset, 0), 100000));
$$;
revoke all on function public.search_public_players(text, text, integer, integer) from public;
grant execute on function public.search_public_players(text, text, integer, integer) to anon, authenticated;


-- Compatibility repair: production already exposes the five-argument directory RPC.
-- The username/offset RPC above is a separate overload, not a replacement.
-- Keep five-argument positional calls; remove optional defaults to avoid\n-- ambiguous resolution against the new four-argument RPC. Audit named/partial\n-- legacy callers before production deployment.\n-- Prevent private country or
-- unapproved avatar disclosure in the legacy result and its search predicates.
CREATE OR REPLACE FUNCTION public.search_public_players(
  p_query text,
  p_country text,
  p_position text,
  p_verified_only boolean,
  p_limit integer
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
