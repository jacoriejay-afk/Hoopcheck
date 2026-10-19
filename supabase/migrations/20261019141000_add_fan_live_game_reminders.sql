-- Minimal production schema dependency for the live-game reminder UI and sync job.
-- Kept separate from the larger unreviewed trust/journey feature migration.

create table if not exists public.fan_live_game_reminders (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.fan_live_games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  constraint fan_live_game_reminders_game_user_key unique (game_id, user_id)
);

alter table public.fan_live_game_reminders
  add column if not exists notified_at timestamptz;

create index if not exists fan_live_game_reminders_user_created_idx
  on public.fan_live_game_reminders(user_id, created_at desc);

alter table public.fan_live_game_reminders enable row level security;

revoke all on table public.fan_live_game_reminders from public, anon, authenticated;
grant select, insert, update, delete on table public.fan_live_game_reminders to authenticated;
grant all on table public.fan_live_game_reminders to service_role;

drop policy if exists "users manage own game reminders" on public.fan_live_game_reminders;
create policy "users manage own game reminders"
  on public.fan_live_game_reminders for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
