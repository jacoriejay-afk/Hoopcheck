-- LIVE-2 Part A: additive provenance model. Review and stage before production migration.
-- Legacy cancellation statuses are preserved until the sync/UI transition backfills them.
ALTER TABLE public.fan_live_games
  ADD COLUMN IF NOT EXISTS score_source text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS score_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_url text,
  ADD COLUMN IF NOT EXISTS provider_status_detail text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.fan_live_games'::regclass AND conname = 'fan_live_games_score_source_check') THEN
    ALTER TABLE public.fan_live_games ADD CONSTRAINT fan_live_games_score_source_check
      CHECK (score_source IN ('api','fan','none'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.fan_live_games'::regclass AND conname = 'fan_live_games_score_timestamp_check') THEN
    ALTER TABLE public.fan_live_games ADD CONSTRAINT fan_live_games_score_timestamp_check
      CHECK (score_source <> 'none' OR score_updated_at IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.fan_live_games'::regclass AND conname = 'fan_live_games_stream_url_check') THEN
    ALTER TABLE public.fan_live_games ADD CONSTRAINT fan_live_games_stream_url_check
      CHECK (stream_url IS NULL OR stream_url ~* '^https://[^[:space:]]+$');
  END IF;
END $$;

COMMENT ON COLUMN public.fan_live_games.score_source IS 'LIVE-2 provenance: api, fan, or none. Legacy rows default to none until verified backfill.';
COMMENT ON COLUMN public.fan_live_games.score_updated_at IS 'Last verified score change; never use generic row updated_at as evidence of a fresh score.';
COMMENT ON COLUMN public.fan_live_games.stream_url IS 'Official HTTPS stream URL set by an authorized club manager or admin.';
COMMENT ON COLUMN public.fan_live_games.provider_status_detail IS 'Preserves provider cancellation/postponement detail outside the three-state game lifecycle.';
