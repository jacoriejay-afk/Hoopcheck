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
      when fr.target_type = 'team' then team.name else null end,
    case when p_mode = 'followers' then follower.avatar_url else target_profile.avatar_url end,
    case when p_mode = 'followers' then follower.account_type else target_profile.account_type end,
    case when p_mode = 'followers' then coalesce(follower.player_verified,false) else coalesce(target_profile.player_verified,false) end
  from public.follow_relationships fr
  left join public.profiles follower on follower.id = fr.follower_id
  left join public.profiles target_profile on fr.target_type in ('player','fan') and target_profile.id = fr.target_id
  left join public.teams team on fr.target_type = 'team' and team.id = fr.target_id
  where (
    (p_mode = 'followers' and fr.target_type = p_target_type and fr.target_id = p_target_id)
    or (p_mode = 'following' and fr.follower_id = p_user_id and auth.uid() = p_user_id)
  )
  and (
    (p_mode = 'followers' and follower.profile_visibility = 'public')
    or (p_mode = 'following' and (fr.target_type = 'team' or target_profile.profile_visibility = 'public' or target_profile.id = auth.uid()))
  )
  order by fr.created_at desc;
$$;
revoke all on function public.get_public_follow_list(text,text,uuid,uuid) from public;
grant execute on function public.get_public_follow_list(text,text,uuid,uuid) to authenticated;

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
