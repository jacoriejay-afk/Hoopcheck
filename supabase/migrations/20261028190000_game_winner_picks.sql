create table if not exists public.game_winner_picks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.fan_live_games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  picked_team_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, user_id)
);
create index if not exists game_winner_picks_game_idx on public.game_winner_picks(game_id);
create index if not exists game_winner_picks_user_idx on public.game_winner_picks(user_id);
alter table public.game_winner_picks enable row level security;
revoke all on public.game_winner_picks from anon, authenticated;
grant select, insert, update, delete on public.game_winner_picks to service_role;