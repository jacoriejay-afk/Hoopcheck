-- HOOPDATA-1 REVIEW ONLY. Separate staging from canonical game records.
BEGIN;
CREATE TABLE public.hoopdata_season_imports (
  provider text NOT NULL CHECK (provider IN ('balldontlie-nba','balldontlie-wnba')),
  season integer NOT NULL CHECK (season BETWEEN 1900 AND 2200),
  next_cursor bigint CHECK (next_cursor > 0),
  completed boolean NOT NULL DEFAULT false,
  pages integer NOT NULL DEFAULT 0 CHECK (pages >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider,season)
);
CREATE TABLE public.hoopdata_fixture_stage (
  provider text NOT NULL,
  season integer NOT NULL,
  provider_game_id text NOT NULL CHECK (provider_game_id ~ '^[1-9][0-9]*$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider,season,provider_game_id),
  FOREIGN KEY(provider,season) REFERENCES public.hoopdata_season_imports(provider,season) ON DELETE CASCADE
);
ALTER TABLE public.hoopdata_season_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoopdata_fixture_stage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_season_imports,public.hoopdata_fixture_stage FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.hoopdata_season_imports,public.hoopdata_fixture_stage TO service_role;
-- Atomic page commit: only the current cursor may advance. Completion denotes
-- pagination exhausted, NOT authoritative season coverage or verified scores.
CREATE FUNCTION public.hoopdata_commit_season_page(p_provider text,p_season integer,p_expected bigint,p_next bigint,p_fixtures jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $page$
DECLARE
  job public.hoopdata_season_imports%ROWTYPE;
  item jsonb;
  game_id text;
  seen text[] := ARRAY[]::text[];
BEGIN
  IF p_provider IS NULL OR p_provider NOT IN ('balldontlie-nba','balldontlie-wnba') OR p_season IS NULL OR p_season NOT BETWEEN 1900 AND 2200 THEN RETURN false; END IF;
  IF p_expected IS NOT NULL AND p_expected <= 0 THEN RETURN false; END IF;
  IF p_next IS NOT NULL AND p_next <= coalesce(p_expected,0) THEN RETURN false; END IF;
  IF p_fixtures IS NULL OR jsonb_typeof(p_fixtures) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_fixtures)>100 OR (p_next IS NOT NULL AND jsonb_array_length(p_fixtures)=0) THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_fixtures) LOOP
    game_id := item->>'id';
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR item->>'provider' IS DISTINCT FROM p_provider OR item->>'season' IS DISTINCT FROM p_season::text OR game_id IS NULL OR game_id !~ '^[1-9][0-9]*$' OR game_id=ANY(seen) THEN RETURN false; END IF;
    seen := array_append(seen,game_id);
  END LOOP;
  INSERT INTO public.hoopdata_season_imports(provider,season) VALUES(p_provider,p_season) ON CONFLICT DO NOTHING;
  SELECT * INTO job FROM public.hoopdata_season_imports WHERE provider=p_provider AND season=p_season FOR UPDATE;
  IF NOT FOUND OR job.completed OR job.next_cursor IS DISTINCT FROM p_expected THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_fixtures) LOOP
    INSERT INTO public.hoopdata_fixture_stage(provider,season,provider_game_id,payload) VALUES(p_provider,p_season,item->>'id',item)
      ON CONFLICT(provider,season,provider_game_id) DO UPDATE SET payload=excluded.payload,observed_at=clock_timestamp();
  END LOOP;
  UPDATE public.hoopdata_season_imports SET next_cursor=p_next,completed=(p_next IS NULL),pages=pages+1,updated_at=clock_timestamp()
    WHERE provider=p_provider AND season=p_season;
  RETURN true;
END;
$page$;
REVOKE ALL ON FUNCTION public.hoopdata_commit_season_page(text,integer,bigint,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hoopdata_commit_season_page(text,integer,bigint,bigint,jsonb) TO service_role;
COMMIT;
