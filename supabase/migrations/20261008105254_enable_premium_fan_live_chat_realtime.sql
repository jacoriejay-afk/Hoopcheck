-- Premium Fan live game chat schema + Realtime publication.
create table if not exists public.fan_live_games (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade, opponent_name text not null,
  status text not null default 'live' check (status in ('scheduled','live','final')), home_score integer, away_score integer, started_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists fan_live_games_team_status_idx on public.fan_live_games(team_id,status,started_at desc);
create table if not exists public.fan_live_chat_messages (
  id uuid primary key default gen_random_uuid(), game_id uuid not null references public.fan_live_games(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500), created_at timestamptz not null default now()
);
create index if not exists fan_live_chat_game_created_idx on public.fan_live_chat_messages(game_id,created_at);
alter table public.fan_live_games enable row level security;
alter table public.fan_live_chat_messages enable row level security;
drop policy if exists "premium fans can view live games for followed teams" on public.fan_live_games;
create policy "premium fans can view live games for followed teams" on public.fan_live_games for select to authenticated using (exists (select 1 from public.profiles p join public.subscriptions s on s.user_id=p.id join public.follow_relationships f on f.follower_id=p.id and f.target_type='team' and f.target_id=fan_live_games.team_id where p.id=auth.uid() and p.account_type='fan' and s.plan='premium' and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end>now())) or public.is_current_user_admin_or_moderator());
drop policy if exists "premium fans can read live chat" on public.fan_live_chat_messages;
create policy "premium fans can read live chat" on public.fan_live_chat_messages for select to authenticated using (exists (select 1 from public.fan_live_games g join public.follow_relationships f on f.target_type='team' and f.target_id=g.team_id and f.follower_id=auth.uid() join public.subscriptions s on s.user_id=auth.uid() join public.profiles p on p.id=auth.uid() where g.id=fan_live_chat_messages.game_id and p.account_type='fan' and s.plan='premium' and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end>now())) or public.is_current_user_admin_or_moderator());
drop policy if exists "premium fans can chat on live games" on public.fan_live_chat_messages;
create policy "premium fans can chat on live games" on public.fan_live_chat_messages for insert to authenticated with check (user_id=auth.uid() and exists (select 1 from public.fan_live_games g join public.follow_relationships f on f.target_type='team' and f.target_id=g.team_id and f.follower_id=auth.uid() join public.subscriptions s on s.user_id=auth.uid() join public.profiles p on p.id=auth.uid() where g.id=fan_live_chat_messages.game_id and g.status='live' and p.account_type='fan' and s.plan='premium' and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end>now())));
alter table public.fan_live_chat_messages replica identity full;
do $$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='fan_live_chat_messages') then alter publication supabase_realtime add table public.fan_live_chat_messages; end if; end $$;