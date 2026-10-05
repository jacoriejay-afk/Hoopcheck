-- Player discovery search RPC
-- Mirrors the live Supabase migration applied for HoopCheck.

create or replace function public.search_public_players(
  p_query text default '',
  p_country text default '',
  p_position text default '',
  p_verified_only boolean default false,
  p_limit integer default 24
)
returns table (
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
security invoker
set search_path = public
as $$
  select
    p.id, p.display_name, p.avatar_url, p.country, p.bio,
    p.position as player_position, p.years_pro, p.current_country,
    p.current_team, p.player_verified, p.player_verified_at
  from public.profiles p
  where p.profile_visibility = 'public'
    and (
      nullif(trim(p_query), '') is null
      or p.display_name ilike '%' || trim(p_query) || '%'
      or p.country ilike '%' || trim(p_query) || '%'
      or p.current_country ilike '%' || trim(p_query) || '%'
      or p.current_team ilike '%' || trim(p_query) || '%'
      or p.position ilike '%' || trim(p_query) || '%'
    )
    and (nullif(trim(p_country), '') is null or p.country = trim(p_country) or p.current_country = trim(p_country))
    and (nullif(trim(p_position), '') is null or p.position = trim(p_position))
    and (coalesce(p_verified_only, false) = false or p.player_verified = true)
  order by p.player_verified desc, p.display_name asc
  limit least(greatest(coalesce(p_limit, 24), 1), 50);
$$;

revoke all on function public.search_public_players(text, text, text, boolean, integer) from public;
grant execute on function public.search_public_players(text, text, text, boolean, integer) to anon, authenticated;

create index if not exists profiles_public_player_search_idx
  on public.profiles (profile_visibility, player_verified desc, display_name);

create index if not exists profiles_public_player_country_idx
  on public.profiles (profile_visibility, country);

create index if not exists profiles_public_player_position_idx
  on public.profiles (profile_visibility, position);
