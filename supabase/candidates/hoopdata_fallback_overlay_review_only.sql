-- REVIEW ONLY. No canonical fixture writes, public access, or enabled jobs.
BEGIN;
CREATE TABLE public.hoopdata_fallback_team_aliases (
  provider text NOT NULL CHECK(provider IN ('balldontlie-nba','balldontlie-wnba')),
  provider_team_id text NOT NULL CHECK(provider_team_id ~ '^[1-9][0-9]*$'),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  reviewed_by uuid NOT NULL,
  evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 1 AND 1000),
  PRIMARY KEY(provider,provider_team_id),UNIQUE(provider,team_id)
);
CREATE TABLE public.hoopdata_fallback_overlays (
  canonical_game_id uuid PRIMARY KEY REFERENCES public.fan_live_games(id) ON DELETE CASCADE,
  provider text NOT NULL,provider_game_id text NOT NULL,
  primary_observed_at timestamptz NOT NULL,
  primary_home_score integer,primary_away_score integer,
  team_id uuid NOT NULL,opponent_team_id uuid NOT NULL,scheduled_at timestamptz NOT NULL,
  home_score integer NOT NULL CHECK(home_score>=0),away_score integer NOT NULL CHECK(away_score>=0),
  observed_at timestamptz NOT NULL,
  FOREIGN KEY(provider,provider_game_id) REFERENCES public.hoopdata_game_aliases(provider,provider_game_id)
);
ALTER TABLE public.hoopdata_fallback_team_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoopdata_fallback_overlays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_fallback_team_aliases,public.hoopdata_fallback_overlays FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.hoopdata_fallback_team_aliases TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.hoopdata_fallback_overlays TO service_role;
-- Trusted server passes validated provider live payload; the database rechecks identity,
-- orientation, current primary snapshot, and monotonic scores. Receipt is not event time.
CREATE FUNCTION public.hoopdata_stage_fallback_overlay(
  p_game uuid,p_provider_game text,p_home_team text,p_away_team text,p_tipoff timestamptz,
  p_home integer,p_away integer,p_expected_primary timestamptz,p_observed timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $stage$
DECLARE g public.fan_live_games%ROWTYPE; h uuid; a uuid; hs integer; aws integer; t timestamptz;
BEGIN
  IF p_home IS NULL OR p_away IS NULL OR p_home<0 OR p_away<0 OR p_tipoff IS NULL OR
    p_expected_primary IS NULL OR p_observed IS NULL OR NOT isfinite(p_observed) THEN RETURN false; END IF;
  SELECT * INTO g FROM public.fan_live_games WHERE id=p_game FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  t:=clock_timestamp();
  IF g.status IS DISTINCT FROM 'live' OR g.provider_source IS DISTINCT FROM 'api-sports-basketball' OR
    g.score_updated_at IS DISTINCT FROM p_expected_primary OR g.score_updated_at>=t-interval '25 minutes' OR
    g.scheduled_at IS DISTINCT FROM p_tipoff OR p_observed<=g.score_updated_at OR
    p_observed>t OR p_observed<t-interval '5 minutes' THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.hoopdata_game_aliases WHERE provider='balldontlie-nba'
    AND provider_game_id=p_provider_game AND canonical_game_id=p_game) THEN RETURN false; END IF;
  SELECT team_id INTO h FROM public.hoopdata_fallback_team_aliases WHERE provider='balldontlie-nba' AND provider_team_id=p_home_team;
  SELECT team_id INTO a FROM public.hoopdata_fallback_team_aliases WHERE provider='balldontlie-nba' AND provider_team_id=p_away_team;
  IF h IS NULL OR a IS NULL OR h=a OR g.team_id IS NULL OR g.opponent_team_id IS NULL THEN RETURN false; END IF;
  IF g.team_id=h AND g.opponent_team_id=a THEN hs:=p_home; aws:=p_away;
  ELSIF g.team_id=a AND g.opponent_team_id=h THEN hs:=p_away; aws:=p_home;
  ELSE RETURN false; END IF;
  IF (g.home_score IS NOT NULL AND hs<g.home_score) OR (g.away_score IS NOT NULL AND aws<g.away_score) THEN RETURN false; END IF;
  INSERT INTO public.hoopdata_fallback_overlays AS o(canonical_game_id,provider,provider_game_id,
    primary_observed_at,primary_home_score,primary_away_score,team_id,opponent_team_id,scheduled_at,home_score,away_score,observed_at)
  VALUES(p_game,'balldontlie-nba',p_provider_game,g.score_updated_at,g.home_score,g.away_score,
    g.team_id,g.opponent_team_id,g.scheduled_at,hs,aws,p_observed)
  ON CONFLICT(canonical_game_id) DO UPDATE SET provider=excluded.provider,provider_game_id=excluded.provider_game_id,
    primary_observed_at=excluded.primary_observed_at,primary_home_score=excluded.primary_home_score,
    primary_away_score=excluded.primary_away_score,team_id=excluded.team_id,opponent_team_id=excluded.opponent_team_id,
    scheduled_at=excluded.scheduled_at,home_score=excluded.home_score,away_score=excluded.away_score,observed_at=excluded.observed_at
  WHERE o.observed_at<excluded.observed_at AND
    (o.primary_observed_at<>excluded.primary_observed_at OR (excluded.home_score>=o.home_score AND excluded.away_score>=o.away_score));
  RETURN FOUND;
END $stage$;
-- Read only a still-applicable overlay; primary recovery immediately invalidates it.
CREATE FUNCTION public.hoopdata_read_fallback_overlay(p_game uuid)
RETURNS TABLE(home_score integer,away_score integer,observed_at timestamptz,provider text)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $read$
  SELECT o.home_score,o.away_score,o.observed_at,o.provider FROM public.hoopdata_fallback_overlays o
  JOIN public.fan_live_games g ON g.id=o.canonical_game_id
  WHERE o.canonical_game_id=p_game AND g.status='live' AND g.provider_source='api-sports-basketball'
    AND g.score_updated_at=o.primary_observed_at AND g.score_updated_at<clock_timestamp()-interval '25 minutes'
    AND g.home_score IS NOT DISTINCT FROM o.primary_home_score AND g.away_score IS NOT DISTINCT FROM o.primary_away_score
    AND g.team_id=o.team_id AND g.opponent_team_id=o.opponent_team_id AND g.scheduled_at=o.scheduled_at
    AND o.observed_at BETWEEN clock_timestamp()-interval '5 minutes' AND clock_timestamp()
$read$;
REVOKE ALL ON FUNCTION public.hoopdata_stage_fallback_overlay(uuid,text,text,text,timestamptz,integer,integer,timestamptz,timestamptz),public.hoopdata_read_fallback_overlay(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoopdata_stage_fallback_overlay(uuid,text,text,text,timestamptz,integer,integer,timestamptz,timestamptz),public.hoopdata_read_fallback_overlay(uuid) TO service_role;
COMMIT;
