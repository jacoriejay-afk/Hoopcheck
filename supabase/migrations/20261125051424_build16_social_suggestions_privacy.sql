CREATE OR REPLACE FUNCTION public.get_social_suggestions()
 RETURNS TABLE(entity_type text, entity_id uuid, display_name text, avatar_url text, detail text, player_verified boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with followed_players as (
    select target_id from public.follow_relationships
    where follower_id = auth.uid() and target_type = 'player'
  ),
  player_suggestions as (
    select 'player'::text as entity_type, candidate.id as entity_id,
      candidate.display_name, case when candidate.avatar_moderation_status is null or candidate.avatar_moderation_status = 'approved' then candidate.avatar_url else null end as avatar_url,
      coalesce(candidate.current_team, case when candidate.current_country_public is true then candidate.current_country else null end, candidate.country, 'Player') as detail,
      coalesce(candidate.player_verified,false) as player_verified,
      count(*) as connection_weight
    from public.follow_relationships graph
    join followed_players fp on fp.target_id = graph.follower_id
    join public.profiles candidate on candidate.id = graph.target_id
    where graph.target_type = 'player'
      and candidate.profile_visibility = 'public'
      and candidate.account_type = 'player'
      and candidate.moderation_status is distinct from 'suspended'
      and candidate.id <> auth.uid()
      and not exists (select 1 from public.follow_relationships mine where mine.follower_id = auth.uid() and mine.target_type = 'player' and mine.target_id = candidate.id)
    group by candidate.id
  ),
  team_suggestions as (
    select 'team'::text as entity_type, coalesce(team.id, womens_team.id) as entity_id,
      coalesce(team.name, womens_team.name) as display_name,
      coalesce(team.logo_url, womens_team.logo_url) as avatar_url,
      coalesce(team.country, womens_team.country, team.league_name, womens_team.league_name, 'Team') as detail,
      false as player_verified,
      count(*) as connection_weight
    from public.follow_relationships graph
    join followed_players fp on fp.target_id = graph.follower_id
    left join public.teams team on team.id = graph.target_id
    left join public.womens_teams womens_team on womens_team.id = graph.target_id
    where graph.target_type = 'team'
      and coalesce(team.id, womens_team.id) is not null
      and not exists (select 1 from public.follow_relationships mine where mine.follower_id = auth.uid() and mine.target_type = 'team' and mine.target_id = coalesce(team.id, womens_team.id))
    group by team.id, womens_team.id
  )
  select entity_type, entity_id, display_name, avatar_url, detail, player_verified
  from (
    select * from player_suggestions
    union all
    select * from team_suggestions
  ) suggestions
  order by connection_weight desc, display_name
  limit 8;
$function$;
