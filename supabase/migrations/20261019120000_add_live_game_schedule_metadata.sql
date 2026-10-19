-- Add fields used by the live basketball sync and client schedule views.
-- This migration is for review; it is not applied to production by this change.

alter table public.fan_live_games
  add column if not exists scheduled_at timestamptz,
  add column if not exists league_id uuid references public.leagues(id) on delete set null,
  add column if not exists league_name text,
  add column if not exists country text,
  add column if not exists period_label text;

alter table public.fan_live_games
  drop constraint if exists fan_live_games_status_check;

alter table public.fan_live_games
  add constraint fan_live_games_status_check
  check (
    status = any (
      array[
        'scheduled'::text,
        'live'::text,
        'final'::text,
        'cancelled'::text,
        'canceled'::text,
        'postponed'::text,
        'abandoned'::text
      ]
    )
  );

create index if not exists fan_live_games_status_scheduled_at_idx
  on public.fan_live_games(status, scheduled_at);

-- The provider map is server-only; RLS remains enabled as defense in depth.
revoke all on table public.fan_live_team_provider_map from public, anon, authenticated;
