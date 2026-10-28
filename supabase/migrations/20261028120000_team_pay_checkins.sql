-- Anonymous monthly pay check-ins. Individual records are never exposed through client reads.
create table if not exists public.team_pay_checkins (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  pay_month date not null,
  pay_status text not null check (pay_status in ('on_time','late','missing')),
  created_at timestamptz not null default now(),
  constraint team_pay_checkins_one_per_player_month unique (team_id, player_id, pay_month),
  constraint team_pay_checkins_month_start check (extract(day from pay_month) = 1)
);
create index if not exists team_pay_checkins_team_month_idx on public.team_pay_checkins(team_id, pay_month);
alter table public.team_pay_checkins enable row level security;
-- No client SELECT/UPDATE/DELETE policy by design. Reads/writes are mediated by the server API.
revoke all on public.team_pay_checkins from anon, authenticated;
grant insert, select on public.team_pay_checkins to service_role;
