-- Verified recurring league windows. Unconfigured leagues remain unknown.
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS season_start_month smallint,
  ADD COLUMN IF NOT EXISTS season_start_day smallint,
  ADD COLUMN IF NOT EXISTS season_end_month smallint,
  ADD COLUMN IF NOT EXISTS season_end_day smallint,
  ADD COLUMN IF NOT EXISTS season_label text,
  ADD COLUMN IF NOT EXISTS season_time_zone text;

-- Calendar-valid month/day pairs, including Feb 29 (handled by resolver in non-leap years).
-- Re-runnable guard: PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.leagues'::regclass AND conname = 'leagues_season_complete') THEN
    ALTER TABLE public.leagues ADD CONSTRAINT leagues_season_complete CHECK (
      num_nonnulls(season_start_month, season_start_day, season_end_month, season_end_day) IN (0, 4));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.leagues'::regclass AND conname = 'leagues_season_start_valid') THEN
    ALTER TABLE public.leagues ADD CONSTRAINT leagues_season_start_valid CHECK (
      season_start_month BETWEEN 1 AND 12 AND season_start_day BETWEEN 1 AND
      CASE WHEN season_start_month=2 THEN 29 WHEN season_start_month IN (4,6,9,11) THEN 30 ELSE 31 END);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.leagues'::regclass AND conname = 'leagues_season_end_valid') THEN
    ALTER TABLE public.leagues ADD CONSTRAINT leagues_season_end_valid CHECK (
      season_end_month BETWEEN 1 AND 12 AND season_end_day BETWEEN 1 AND
      CASE WHEN season_end_month=2 THEN 29 WHEN season_end_month IN (4,6,9,11) THEN 30 ELSE 31 END);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.leagues'::regclass AND conname = 'leagues_season_distinct_bounds') THEN
    ALTER TABLE public.leagues ADD CONSTRAINT leagues_season_distinct_bounds CHECK (
      season_start_month <> season_end_month OR season_start_day <> season_end_day);
  END IF;
END $$;

-- Leave timezone NULL until the league's competition timezone is verified.
-- UTC is a visible, provisional fallback in the read-only API, not stored as fact.
COMMENT ON COLUMN public.leagues.season_time_zone IS 'IANA competition timezone; NULL means not verified';

COMMENT ON COLUMN public.leagues.season_label IS 'Admin-selected display label; may require annual update; computed label used when NULL';

-- Game-to-league identity is required for fail-closed season checks.
-- Nullable because a provider fixture may not map unambiguously to one league.
ALTER TABLE public.fan_live_games
  ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES public.leagues(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS fan_live_games_league_id_idx ON public.fan_live_games(league_id);
COMMENT ON COLUMN public.fan_live_games.league_id IS 'Verified internal competition ID; NULL blocks season-gated actions';
