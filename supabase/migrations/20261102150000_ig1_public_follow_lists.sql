-- IG-1: expose only public profile rows from the existing follow graph.
create or replace function public.get_public_follow_list(
  p_mode text,
  p_target_type text default null,
  p_target_id uuid default null,
  p_user_id uuid default null
)
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  display_name text,
  avatar_url text,
  account_type text,
  player_verified boolean
)
language sql stable security definer set search_path = public
as $$
  select
    case when p_mode = 'followers' then follower.id else fr.target_id end,
    fr.target_type,
    fr.target_id,
    case when p_mode = 'followers' then follower.display_name
      when fr.target_type in ('player','fan') then target_profile.display_name
      when fr.target_type = 'team' then coalesce(team.name, womens_team.name) else null end,
    case when p_mode = 'followers' then follower.avatar_url else coalesce(target_profile.avatar_url, team.logo_url, womens_team.logo_url) end,
    case when p_mode = 'followers' then follower.account_type else target_profile.account_type end,
    case when p_mode = 'followers' then coalesce(follower.player_verified,false) else coalesce(target_profile.player_verified,false) end
  from public.follow_relationships fr
  left join public.profiles follower on follower.id = fr.follower_id
  left join public.profiles target_profile on fr.target_type in ('player','fan') and target_profile.id = fr.target_id
  left join public.teams team on fr.target_type = 'team' and team.id = fr.target_id
  left join public.womens_teams womens_team on fr.target_type = 'team' and womens_team.id = fr.target_id
  where (
    (p_mode = 'followers' and fr.target_type = p_target_type and fr.target_id = p_target_id)
    or (p_mode = 'following' and fr.follower_id = p_user_id and (auth.uid() = p_user_id or follower.profile_visibility = 'public'))
  )
  and (
    (p_mode = 'followers' and follower.profile_visibility = 'public')
    or (p_mode = 'following' and (fr.target_type = 'team' or target_profile.profile_visibility = 'public' or target_profile.id = auth.uid()))
  )
  order by fr.created_at desc;
$$;
revoke all on function public.get_public_follow_list(text,text,uuid,uuid) from public;
grant execute on function public.get_public_follow_list(text,text,uuid,uuid) to anon, authenticated;

create or replace function public.get_public_following_count(p_user_id uuid)
returns bigint language sql stable security definer set search_path = public
as $$
  select count(*)
  from public.follow_relationships fr
  left join public.profiles target_profile on fr.target_type in ('player','fan') and target_profile.id = fr.target_id
  where fr.follower_id = p_user_id
    and (
      auth.uid() = p_user_id
      or fr.target_type = 'team'
      or target_profile.profile_visibility = 'public'
    );
$$;
revoke all on function public.get_public_following_count(uuid) from public;
grant execute on function public.get_public_following_count(uuid) to anon, authenticated;

create or replace function public.get_shared_team_followers(p_team_id uuid)
returns table(display_name text)
language sql stable security definer set search_path = public
as $$
  select distinct follower.display_name
  from public.follow_relationships mine
  join public.follow_relationships team_follow
    on team_follow.follower_id = mine.target_id
   and team_follow.target_type = 'team'
   and team_follow.target_id = p_team_id
  join public.profiles follower on follower.id = mine.target_id
  where mine.follower_id = auth.uid()
    and mine.target_type = 'player'
    and follower.account_type = 'player'
    and follower.profile_visibility = 'public'
    and follower.display_name is not null
  order by follower.display_name
  limit 3;
$$;
revoke all on function public.get_shared_team_followers(uuid) from public;
grant execute on function public.get_shared_team_followers(uuid) to authenticated;

create or replace function public.get_social_suggestions()
returns table(entity_type text, entity_id uuid, display_name text, avatar_url text, detail text, player_verified boolean)
language sql stable security definer set search_path = public
as $$
  with followed_players as (
    select target_id from public.follow_relationships
    where follower_id = auth.uid() and target_type = 'player'
  ),
  player_suggestions as (
    select 'player'::text as entity_type, candidate.id as entity_id,
      candidate.display_name, candidate.avatar_url,
      coalesce(candidate.current_team, candidate.current_country, candidate.country, 'Player') as detail,
      coalesce(candidate.player_verified,false) as player_verified,
      count(*) as connection_weight
    from public.follow_relationships graph
    join followed_players fp on fp.target_id = graph.follower_id
    join public.profiles candidate on candidate.id = graph.target_id
    where graph.target_type = 'player'
      and candidate.profile_visibility = 'public'
      and candidate.account_type = 'player'
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
$$;
revoke all on function public.get_social_suggestions() from public;
grant execute on function public.get_social_suggestions() to authenticated;
