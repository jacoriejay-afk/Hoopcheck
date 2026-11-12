-- Explicit, reviewable competition mappings. No inferred assignments or production backfill.
create table if not exists public.fan_live_league_provider_map (
  provider_source text not null,
  provider_league_id bigint not null check (provider_league_id > 0),
  league_id uuid not null references public.leagues(id) on delete cascade,
  provider_league_name text,
  provider_country text,
  verified_at timestamptz not null default now(),
  primary key (provider_source, provider_league_id)
);
create index if not exists fan_live_league_provider_map_league_idx
  on public.fan_live_league_provider_map(league_id);
alter table public.fan_live_league_provider_map enable row level security;
revoke all on public.fan_live_league_provider_map from anon, authenticated;
-- The privileged score-sync service reads mappings; only reviewed admin SQL
-- should populate this table. No user-facing write policy is granted.
