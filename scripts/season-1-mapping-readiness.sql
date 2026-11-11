-- SEASON-1: read-only fixture mapping readiness audit.
-- Run against staging before applying season-aware visibility gates.
-- A team league is not proof of the competition for a fixture.
WITH fixture AS (
  SELECT g.id, g.status, g.league_id, g.league_name, g.country,
         g.opponent_team_id, t.league_id AS home_league_id,
         o.league_id AS away_league_id,
         (SELECT count(*) FROM public.leagues l
          WHERE lower(btrim(l.name)) = lower(btrim(g.league_name))
            AND lower(btrim(l.country)) = lower(btrim(g.country))) AS exact_competition_matches
  FROM public.fan_live_games g
  LEFT JOIN public.teams t ON t.id = g.team_id
  LEFT JOIN public.teams o ON o.id = g.opponent_team_id
)
SELECT count(*) AS total_fixtures,
       count(*) FILTER (WHERE league_id IS NOT NULL) AS verified_league_ids,
       count(*) FILTER (WHERE league_id IS NULL) AS unmapped_fixtures,
       count(*) FILTER (WHERE status IN ('scheduled','live') AND league_id IS NULL) AS unmapped_active_fixtures,
       count(*) FILTER (WHERE home_league_id IS NOT NULL AND home_league_id = away_league_id) AS agreeing_team_leagues,
       count(*) FILTER (WHERE home_league_id IS NOT NULL AND away_league_id IS NOT NULL AND home_league_id <> away_league_id) AS conflicting_team_leagues,
       count(*) FILTER (WHERE opponent_team_id IS NULL) AS missing_opponent_ids,
       count(*) FILTER (WHERE exact_competition_matches = 1) AS unique_name_country_matches,
       count(*) FILTER (WHERE exact_competition_matches > 1) AS ambiguous_name_country_matches
FROM fixture;
