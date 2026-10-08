-- Launch performance indexes for high-traffic public directories.
create index if not exists teams_active_name_idx
  on public.teams (name)
  where active = true;

create index if not exists leagues_active_name_idx
  on public.leagues (name)
  where active = true;

create index if not exists womens_teams_active_name_idx
  on public.womens_teams (name)
  where active = true;

create index if not exists profiles_public_players_directory_idx
  on public.profiles (display_name)
  where account_type = 'player'
    and profile_visibility = 'public'
    and (moderation_status is null or moderation_status <> 'suspended')
    and (basketball_type is null or basketball_type <> 'womens');
