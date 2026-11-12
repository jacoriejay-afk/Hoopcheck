-- SEASON-1: reviewed fixture-to-league backfill. Run ONLY after migration,
-- provider identity sync, manual competition verification, and staging QA.
-- This script is NOT automatically executed by migrations or deployments.
-- Execute inside a transaction; inspect the RETURNING output before COMMIT.
-- A verified mapping is the only accepted authority for league assignment.
BEGIN;

-- Stop if any existing assignment disagrees with a reviewed mapping.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.fan_live_games g
    JOIN public.fan_live_league_provider_map m
      ON m.provider_source = g.provider_source
     AND m.provider_league_id = g.provider_league_id
    WHERE g.league_id IS NOT NULL AND g.league_id <> m.league_id
  ) THEN
    RAISE EXCEPTION 'SEASON-1: conflicting fixture league assignments; review before backfill';
  END IF;
END $$;

-- Only fill NULL assignments with explicitly reviewed provider mappings.
WITH updated AS (
  UPDATE public.fan_live_games g
     SET league_id = m.league_id
    FROM public.fan_live_league_provider_map m
   WHERE g.provider_source = m.provider_source
     AND g.provider_league_id = m.provider_league_id
     AND g.league_id IS NULL
  RETURNING g.id, g.provider_source, g.provider_game_id, g.provider_league_id, g.league_id, g.status
)
SELECT * FROM updated ORDER BY provider_source, provider_game_id;

-- Safety default: review rows first, then explicitly replace ROLLBACK with
-- COMMIT in an approved staging run. Never run against production by default.
ROLLBACK;
