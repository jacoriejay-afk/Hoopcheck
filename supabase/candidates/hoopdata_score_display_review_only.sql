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
  LEFT JOIN LATERAL public.hoopdata_read_fallback_overlay(g.id) o ON true
  WHERE g.id=p_game;
$display$;
REVOKE ALL ON FUNCTION public.hoopdata_read_score_display(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoopdata_read_score_display(uuid) TO service_role;
COMMIT;
