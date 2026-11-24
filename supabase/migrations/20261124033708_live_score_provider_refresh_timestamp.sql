-- Build 11 live score freshness: nullable and backward-compatible.
-- This is the receipt time of a successful provider snapshot, not a guessed score-change time.
-- Never backfill old fixtures with now() or infer a final result.
alter table public.fan_live_games
  add column if not exists score_updated_at timestamptz;

comment on column public.fan_live_games.score_updated_at is
  'Server timestamp of the last successful provider snapshot for this fixture; null means no verified refresh timestamp.';
