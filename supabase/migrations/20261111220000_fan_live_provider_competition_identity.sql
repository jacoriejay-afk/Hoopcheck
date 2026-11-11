-- SEASON-1: retain provider competition identity for reviewed mapping/backfill.
-- Nullable for legacy fixtures and provider responses without a competition ID.
-- This migration does not assign any internal league or rewrite existing games.
ALTER TABLE public.fan_live_games
  ADD COLUMN IF NOT EXISTS provider_league_id bigint;

-- Idempotent constraint creation for migration replay in isolated staging.
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.fan_live_games'::regclass
      AND conname = 'fan_live_games_provider_league_id_positive'
  ) THEN
    ALTER TABLE public.fan_live_games
      ADD CONSTRAINT fan_live_games_provider_league_id_positive
      CHECK (provider_league_id IS NULL OR provider_league_id > 0);
  END IF;
END $;

CREATE INDEX IF NOT EXISTS fan_live_games_provider_competition_idx
  ON public.fan_live_games(provider_source, provider_league_id)
  WHERE provider_league_id IS NOT NULL;

COMMENT ON COLUMN public.fan_live_games.provider_league_id IS
  'Provider competition identifier; never implies a verified internal league mapping by itself';
