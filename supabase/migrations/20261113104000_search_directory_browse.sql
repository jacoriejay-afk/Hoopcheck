CREATE OR REPLACE FUNCTION public.search_public_players_page(p_query text DEFAULT ''::text, p_country text DEFAULT ''::text, p_position text DEFAULT ''::text, p_verified_only boolean DEFAULT false, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, display_name text, avatar_url text, country text, bio text, player_position text, years_pro integer, current_country text, current_team text, player_verified boolean, player_verified_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
    p.id, p.display_name, p.avatar_url, p.country, p.bio,
    p.position as player_position, p.years_pro, p.current_country,
    p.current_team, p.player_verified, p.player_verified_at
  from public.profiles p
  where p.profile_visibility = 'public'
    and p.account_type = 'player'
    and coalesce(p.moderation_status, 'active') <> 'suspended'
    and (coalesce(p.basketball_type, 'mens') = 'mens')
    and (
      nullif(trim(p_query), '') is null
      or p.display_name ilike '%' || trim(p_query) || '%'
      or p.username ilike '%' || trim(p_query) || '%'
      or p.country ilike '%' || trim(p_query) || '%'
      or p.current_country ilike '%' || trim(p_query) || '%'
      or p.current_team ilike '%' || trim(p_query) || '%'
      or p.position ilike '%' || trim(p_query) || '%'
    )
    and (nullif(trim(p_country), '') is null or p.country = trim(p_country) or p.current_country = trim(p_country))
    and (nullif(trim(p_position), '') is null or p.position = trim(p_position))
    and (coalesce(p_verified_only, false) = false or p.player_verified = true)
  order by p.player_verified desc, p.display_name asc, p.id
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

revoke all on function public.search_public_players_page(text, text, text, boolean, integer, integer) from public;
grant execute on function public.search_public_players_page(text, text, text, boolean, integer, integer) to anon, authenticated;

create function public.search_directory_overview()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with active_teams as (
    select trim(country) as country, 'mens' as side from public.teams
      where active and basketball_type = 'mens'
    union all
    select trim(country), 'womens' from public.womens_teams where active
  ), top_countries as (
    select min(country) as country, count(*) as total
    from active_teams where nullif(country, '') is not null
    group by lower(country) order by total desc, min(country) limit 8
  )
  select jsonb_build_object(
    'mens', (select count(*) from active_teams where side = 'mens'),
    'womens', (select count(*) from active_teams where side = 'womens'),
    'coaches', (select count(*) from public.coaches),
    'leagues', (select count(*) from public.leagues),
    'countries', coalesce((select jsonb_agg(top_countries order by total desc, country) from top_countries), '[]'::jsonb)
  );
$$;

revoke all on function public.search_directory_overview() from public;
grant execute on function public.search_directory_overview() to anon, authenticated;
