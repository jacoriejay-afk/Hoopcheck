-- REVIEW ONLY. Requires merged fallback overlay candidate. No public grants or writes.
BEGIN;
CREATE FUNCTION public.hoopdata_read_score_display(p_game uuid)
RETURNS TABLE(game_id uuid,status text,home_score integer,away_score integer,score_updated_at timestamptz,score_source text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $display$
  SELECT g.id,g.status::text,
    CASE WHEN o.provider IS NOT NULL THEN o.home_score ELSE g.home_score END,
    CASE WHEN o.provider IS NOT NULL THEN o.away_score ELSE g.away_score END,
    CASE WHEN o.provider IS NOT NULL THEN o.observed_at ELSE g.score_updated_at END,
    CASE WHEN o.provider IS NOT NULL THEN 'balldontlie-nba' ELSE 'primary' END
  FROM public.fan_live_games g
  LEFT JOIN public.hoopdata_fallback_overlays o ON o.canonical_game_id=g.id
    AND o.provider='balldontlie-nba' AND g.status='live' AND g.provider_source='api-sports-basketball'
    AND g.score_updated_at=o.primary_observed_at AND g.score_updated_at<statement_timestamp()-interval '25 minutes'
    AND g.home_score IS NOT DISTINCT FROM o.primary_home_score AND g.away_score IS NOT DISTINCT FROM o.primary_away_score
    AND g.team_id=o.team_id AND g.opponent_team_id=o.opponent_team_id AND g.scheduled_at=o.scheduled_at
    AND o.observed_at BETWEEN statement_timestamp()-interval '5 minutes' AND statement_timestamp()
  WHERE g.id=p_game;
$display$;
REVOKE ALL ON FUNCTION public.hoopdata_read_score_display(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoopdata_read_score_display(uuid) TO service_role;
COMMIT;
