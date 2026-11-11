-- SEASON-1: recurring league season windows.
-- Defaults are provisional and editable; existing league-specific metadata should be reviewed.
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS season_start_month smallint,
  ADD COLUMN IF NOT EXISTS season_start_day smallint,
  ADD COLUMN IF NOT EXISTS season_end_month smallint,
  ADD COLUMN IF NOT EXISTS season_end_day smallint,
  ADD COLUMN IF NOT EXISTS season_label text;

-- Conservative regional defaults. League administrators can override each window.
UPDATE public.leagues
SET season_start_month = COALESCE(season_start_month, 9),
    season_start_day = COALESCE(season_start_day, 1),
    season_end_month = COALESCE(season_end_month, 6),
    season_end_day = COALESCE(season_end_day, 30)
WHERE season_start_month IS NULL OR season_start_day IS NULL
   OR season_end_month IS NULL OR season_end_day IS NULL;

ALTER TABLE public.leagues
  ALTER COLUMN season_start_month SET NOT NULL,
  ALTER COLUMN season_start_day SET NOT NULL,
  ALTER COLUMN season_end_month SET NOT NULL,
  ALTER COLUMN season_end_day SET NOT NULL;

ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_season_start_month_check CHECK (season_start_month BETWEEN 1 AND 12),
  ADD CONSTRAINT leagues_season_end_month_check CHECK (season_end_month BETWEEN 1 AND 12),
  ADD CONSTRAINT leagues_season_start_day_check CHECK (season_start_day BETWEEN 1 AND 31),
  ADD CONSTRAINT leagues_season_end_day_check CHECK (season_end_day BETWEEN 1 AND 31);
