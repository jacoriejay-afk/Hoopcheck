-- REVIEW ONLY; isolated database rehearsal required. Never execute on production.
BEGIN;
CREATE TABLE public.hoopdata_competition_preview_targets (
  league_id bigint PRIMARY KEY CHECK (league_id>0),
  enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE public.hoopdata_competition_preview_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  league_id bigint NOT NULL REFERENCES public.hoopdata_competition_preview_targets(league_id),
  endpoint text NOT NULL CHECK(endpoint IN ('leagues','games','standings')),
  season text,
  observed_at timestamptz NOT NULL,
  rows jsonb NOT NULL CHECK(jsonb_typeof(rows)='array'),
  CHECK((endpoint='leagues' AND season IS NULL) OR
    (endpoint IN ('games','standings') AND season IS NOT NULL AND season ~ '^[0-9]{4}(-[0-9]{4})?$'))
);
CREATE INDEX hoopdata_competition_preview_latest ON public.hoopdata_competition_preview_snapshots(league_id,endpoint,season,observed_at DESC);
ALTER TABLE public.hoopdata_competition_preview_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoopdata_competition_preview_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_competition_preview_targets,public.hoopdata_competition_preview_snapshots FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.hoopdata_competition_preview_snapshots_id_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hoopdata_competition_preview_targets TO service_role;
GRANT SELECT,INSERT ON public.hoopdata_competition_preview_snapshots TO service_role;
GRANT USAGE ON SEQUENCE public.hoopdata_competition_preview_snapshots_id_seq TO service_role;
COMMIT;
