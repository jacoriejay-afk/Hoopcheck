-- HOOPDATA-1 REVIEW ONLY. No aliases are auto-created or backfilled.
-- Canonical game IDs remain the existing fan_live_games IDs, preserving chat and picks.
BEGIN;
CREATE TABLE public.hoopdata_game_aliases (
  provider text NOT NULL CHECK (provider IN ('balldontlie-nba','balldontlie-wnba')),
  provider_game_id text NOT NULL CHECK (provider_game_id ~ '^[1-9][0-9]*$'),
  canonical_game_id uuid NOT NULL REFERENCES public.fan_live_games(id) ON DELETE CASCADE,
  reviewed_by uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  evidence text NOT NULL CHECK (length(btrim(evidence)) BETWEEN 1 AND 1000),
  PRIMARY KEY(provider,provider_game_id),
  UNIQUE(provider,canonical_game_id)
);
ALTER TABLE public.hoopdata_game_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_game_aliases FROM PUBLIC,anon,authenticated;
-- Read and insert only; corrections require a separate reviewed administrative operation.
GRANT SELECT,INSERT ON public.hoopdata_game_aliases TO service_role;
COMMIT;
