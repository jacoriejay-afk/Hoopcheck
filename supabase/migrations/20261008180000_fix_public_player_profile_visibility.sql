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
    p.current_country,
    p.current_team,
    p.player_verified,
    p.player_verified_at
  from public.profiles p
  where p.id = p_user_id
    and p.account_type = 'player'
    and p.profile_visibility = 'public'
    and (p.moderation_status is null or p.moderation_status <> 'suspended');
$$;
