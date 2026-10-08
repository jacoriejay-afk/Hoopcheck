alter table public.teams
  add column if not exists basketball_type text not null default 'mens'
  check (basketball_type in ('mens','womens'));

alter table public.leagues
  add column if not exists basketball_type text not null default 'mens'
  check (basketball_type in ('mens','womens'));

create index if not exists teams_basketball_type_active_idx on public.teams (basketball_type, active);
create index if not exists leagues_basketball_type_active_idx on public.leagues (basketball_type, active);
