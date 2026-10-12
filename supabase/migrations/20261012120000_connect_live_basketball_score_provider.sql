-- Provider-backed live basketball games and team ID mappings.
-- This migration is for review only; it is not applied to production by this change.
alter table public.fan_live_games
  add column if not exists opponent_team_id uuid references public.teams(id) on delete set null,
  add column if not exists provider_source text,
  add column if not exists provider_game_id text;

create unique index if not exists fan_live_games_provider_identity_idx
  on public.fan_live_games(provider_source, provider_game_id);

create table if not exists public.fan_live_team_provider_map (
  team_id uuid primary key references public.teams(id) on delete cascade,
  provider_team_id integer not null unique,
  provider_team_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.fan_live_team_provider_map enable row level security;
-- Intentionally no client policies: only trusted server-side service-role code may read mappings.

drop policy if exists "pro premium fans can view live games for followed teams" on public.fan_live_games;
drop policy if exists "premium fans can view live games for followed teams" on public.fan_live_games;
create policy "pro premium fans can view live games for followed teams"
on public.fan_live_games for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    join public.follow_relationships f on f.follower_id = p.id and f.target_type = 'team'
      and f.target_id in (fan_live_games.team_id, fan_live_games.opponent_team_id)
    where p.id = (select auth.uid()) and p.account_type = 'fan'
      and s.plan in ('pro', 'premium') and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  ) or public.is_current_user_admin_or_moderator()
);

drop policy if exists "pro premium fans can read live chat" on public.fan_live_chat_messages;
drop policy if exists "pro premium fans can chat on live games" on public.fan_live_chat_messages;
drop policy if exists "premium fans can read live chat" on public.fan_live_chat_messages;
drop policy if exists "premium fans can chat on live games" on public.fan_live_chat_messages;
create policy "pro premium fans can read live chat"
on public.fan_live_chat_messages for select to authenticated
using (
  exists (
    select 1 from public.fan_live_games g
    join public.follow_relationships f on f.follower_id = (select auth.uid())
      and f.target_type = 'team' and f.target_id in (g.team_id, g.opponent_team_id)
    join public.subscriptions s on s.user_id = (select auth.uid())
    join public.profiles p on p.id = (select auth.uid())
    where g.id = fan_live_chat_messages.game_id and p.account_type = 'fan'
      and s.plan in ('pro', 'premium') and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  ) or public.is_current_user_admin_or_moderator()
);
create policy "pro premium fans can chat on live games"
on public.fan_live_chat_messages for insert to authenticated
with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.fan_live_games g
    join public.follow_relationships f on f.follower_id = (select auth.uid())
      and f.target_type = 'team' and f.target_id in (g.team_id, g.opponent_team_id)
    join public.subscriptions s on s.user_id = (select auth.uid())
    join public.profiles p on p.id = (select auth.uid())
    where g.id = fan_live_chat_messages.game_id and g.status = 'live'
      and p.account_type = 'fan' and s.plan in ('pro', 'premium')
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  )
);

alter table public.fan_live_games replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='fan_live_games') then
    alter publication supabase_realtime add table public.fan_live_games;
  end if;
end $$;
