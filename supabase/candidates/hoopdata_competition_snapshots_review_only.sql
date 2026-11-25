-- HOOPDATA-2 REVIEW ONLY. No production migration or public data publication.
BEGIN;
CREATE TABLE public.hoopdata_competition_mappings (
  league_id uuid PRIMARY KEY REFERENCES public.leagues(id),
  provider_league_id bigint NOT NULL UNIQUE CHECK(provider_league_id>0),
  side text NOT NULL CHECK(side IN ('mens','womens')),
  reviewed boolean NOT NULL DEFAULT false,
  evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 1 AND 2000),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  CHECK(NOT reviewed OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE TABLE public.hoopdata_competition_snapshots (
  league_id uuid NOT NULL REFERENCES public.hoopdata_competition_mappings(league_id),
  provider_league_id bigint NOT NULL,
  kind text NOT NULL CHECK(kind IN ('seasons','games','standings')),
  season text NOT NULL,
  observed_at timestamptz NOT NULL,
  rows jsonb NOT NULL CHECK(jsonb_typeof(rows)='array' AND jsonb_array_length(rows) BETWEEN 1 AND 10000),
  PRIMARY KEY(league_id,kind,season),
  CHECK((kind='seasons' AND season='') OR (kind<>'seasons' AND season ~ '^[0-9]{4}(-[0-9]{4})?$'))
);
ALTER TABLE public.hoopdata_competition_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoopdata_competition_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_competition_mappings,public.hoopdata_competition_snapshots FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.hoopdata_competition_mappings,public.hoopdata_competition_snapshots TO service_role;

CREATE FUNCTION public.hoopdata_stage_competition_snapshot(p_league uuid,p_provider bigint,p_side text,p_kind text,p_season text,p_observed timestamptz,p_rows jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $snapshot$
DECLARE
  m public.hoopdata_competition_mappings%ROWTYPE;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('seasons','games','standings') OR p_observed IS NULL OR p_observed>clock_timestamp()+interval '1 minute' OR p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 10000 OR p_season IS NULL OR (p_kind='seasons' AND p_season<>'') OR (p_kind<>'seasons' AND p_season !~ '^[0-9]{4}(-[0-9]{4})?$') THEN RETURN false; END IF;
  SELECT * INTO m FROM public.hoopdata_competition_mappings WHERE league_id=p_league FOR UPDATE;
  IF NOT FOUND OR NOT m.reviewed OR m.provider_league_id IS DISTINCT FROM p_provider OR m.side IS DISTINCT FROM p_side THEN RETURN false; END IF;
  INSERT INTO public.hoopdata_competition_snapshots(league_id,provider_league_id,kind,season,observed_at,rows)
  VALUES(p_league,p_provider,p_kind,p_season,p_observed,p_rows)
  ON CONFLICT(league_id,kind,season) DO UPDATE SET provider_league_id=excluded.provider_league_id,observed_at=excluded.observed_at,rows=excluded.rows
  WHERE public.hoopdata_competition_snapshots.observed_at<excluded.observed_at;
  RETURN FOUND;
END;
$snapshot$;
REVOKE ALL ON FUNCTION public.hoopdata_stage_competition_snapshot(uuid,bigint,text,text,text,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hoopdata_stage_competition_snapshot(uuid,bigint,text,text,text,timestamptz,jsonb) TO service_role;
COMMIT;
