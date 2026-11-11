-- SEASON-1 recurring windows. Defaults are estimates; league editors must verify actual dates.
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS season_start_month smallint,
  ADD COLUMN IF NOT EXISTS season_start_day smallint,
  ADD COLUMN IF NOT EXISTS season_end_month smallint,
  ADD COLUMN IF NOT EXISTS season_end_day smallint,
  ADD COLUMN IF NOT EXISTS season_label text,
  ADD COLUMN IF NOT EXISTS season_time_zone text;

-- Regional baseline: Northern Hemisphere winter seasons Sep-Jun;
-- Americas winter seasons Oct-Apr; selected summer leagues May-Aug.
-- Explicit per-league values always win.
WITH inferred AS (
 SELECT id,
 CASE
   WHEN country IN ('United States','Canada') AND (name ILIKE '%summer%' OR name ILIKE '%3x3%') THEN 5
   WHEN country IN ('United States','Canada') THEN 10
   WHEN country IN ('Australia','New Zealand') THEN 3
   ELSE 9 END AS sm,
 CASE
   WHEN country IN ('United States','Canada') AND (name ILIKE '%summer%' OR name ILIKE '%3x3%') THEN 8
   WHEN country IN ('United States','Canada') THEN 4
   WHEN country IN ('Australia','New Zealand') THEN 9
   ELSE 6 END AS em
 FROM public.leagues
)
UPDATE public.leagues l SET
 season_start_month = COALESCE(l.season_start_month, i.sm),
 season_start_day = COALESCE(l.season_start_day, 1),
 season_end_month = COALESCE(l.season_end_month, i.em),
 season_end_day = COALESCE(l.season_end_day, CASE WHEN i.em IN (4,6,9) THEN 30 ELSE 31 END),
 season_label = COALESCE(NULLIF(l.season_label,''), NULLIF(l.season,''))
FROM inferred i WHERE l.id=i.id;

ALTER TABLE public.leagues
 ALTER COLUMN season_start_month SET NOT NULL,
 ALTER COLUMN season_start_day SET NOT NULL,
 ALTER COLUMN season_end_month SET NOT NULL,
 ALTER COLUMN season_end_day SET NOT NULL;

-- Calendar-valid month/day pairs, including Feb 29 (handled by resolver in non-leap years).
ALTER TABLE public.leagues
 ADD CONSTRAINT leagues_season_start_valid CHECK (
   season_start_month BETWEEN 1 AND 12 AND season_start_day BETWEEN 1 AND
   CASE WHEN season_start_month=2 THEN 29
        WHEN season_start_month IN (4,6,9,11) THEN 30 ELSE 31 END),
 ADD CONSTRAINT leagues_season_end_valid CHECK (
   season_end_month BETWEEN 1 AND 12 AND season_end_day BETWEEN 1 AND
   CASE WHEN season_end_month=2 THEN 29
        WHEN season_end_month IN (4,6,9,11) THEN 30 ELSE 31 END);

ALTER TABLE public.leagues
 ADD CONSTRAINT leagues_season_distinct_bounds CHECK (
  season_start_month <> season_end_month OR season_start_day <> season_end_day
 );

-- Leave timezone NULL until the league's competition timezone is verified.
-- UTC is a visible, provisional fallback in the read-only API, not stored as fact.
COMMENT ON COLUMN public.leagues.season_time_zone IS 'IANA competition timezone; NULL means not verified';

COMMENT ON COLUMN public.leagues.season_label IS 'Admin-selected display label; may require annual update; computed label used when NULL';
