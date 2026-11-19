-- Draft only: preserve the existing social-suggestion shape while masking private country.
-- This migration depends on follow_relationships, teams, womens_teams, and profiles.
-- Do not apply before full-schema regression and owner approval.
CREATE OR REPLACE FUNCTION public.get_social_suggestions()
RETURNS TABLE(entity_type text, entity_id uuid, display_name text, avatar_url text, detail text, player_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  WITH followed_players AS (
    SELECT target_id FROM public.follow_relationships
    WHERE follower_id = auth.uid() AND target_type = 'player'
  ), player_suggestions AS (
    SELECT 'player'::text AS entity_type, candidate.id AS entity_id,
      candidate.display_name, candidate.avatar_url,
      coalesce(candidate.current_team,
        CASE WHEN candidate.current_country_public IS TRUE THEN candidate.current_country ELSE NULL END,
        candidate.country, 'Player') AS detail,
      coalesce(candidate.player_verified,false) AS player_verified,
      count(*) AS connection_weight
    FROM public.follow_relationships graph
    JOIN followed_players fp ON fp.target_id = graph.follower_id
    JOIN public.profiles candidate ON candidate.id = graph.target_id
    WHERE graph.target_type = 'player'
      AND candidate.profile_visibility = 'public'
      AND candidate.account_type = 'player'
      AND candidate.id <> auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM public.follow_relationships mine
        WHERE mine.follower_id = auth.uid() AND mine.target_type = 'player'
          AND mine.target_id = candidate.id
      )
    GROUP BY candidate.id
  ), team_suggestions AS (
    SELECT 'team'::text AS entity_type,
      coalesce(team.id, womens_team.id) AS entity_id,
      coalesce(team.name, womens_team.name) AS display_name,
      coalesce(team.logo_url, womens_team.logo_url) AS avatar_url,
      coalesce(team.country, womens_team.country, team.league_name, womens_team.league_name, 'Team') AS detail,
      false AS player_verified, count(*) AS connection_weight
    FROM public.follow_relationships graph
    JOIN followed_players fp ON fp.target_id = graph.follower_id
    LEFT JOIN public.teams team ON team.id = graph.target_id
    LEFT JOIN public.womens_teams womens_team ON womens_team.id = graph.target_id
    WHERE graph.target_type = 'team'
      AND coalesce(team.id, womens_team.id) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.follow_relationships mine
        WHERE mine.follower_id = auth.uid() AND mine.target_type = 'team'
          AND mine.target_id = coalesce(team.id, womens_team.id)
      )
    GROUP BY team.id, womens_team.id, team.name, womens_team.name,
      team.logo_url, womens_team.logo_url, team.country, womens_team.country,
      team.league_name, womens_team.league_name
  )
  SELECT entity_type, entity_id, display_name, avatar_url, detail, player_verified
  FROM (
    SELECT * FROM player_suggestions
    UNION ALL
    SELECT * FROM team_suggestions
  ) suggestions
  ORDER BY connection_weight DESC, display_name
  LIMIT 8;
$function$;
-- CREATE OR REPLACE preserves existing EXECUTE grants. Full-schema test required.
