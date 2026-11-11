-- SEASON-1 release gate (read-only). Run on STAGING after migrations,
-- provider competition sync, verified mapping review, and approved backfill.
-- A zero result for active_unmapped is required before enabling fail-closed
-- live-game season filtering; other results require explicit review.
WITH fixtures AS (
 SELECT count(*) AS total_fixtures,
        count(*) FILTER (WHERE status IN ('live','scheduled')) AS active_fixtures,
        count(*) FILTER (WHERE status IN ('live','scheduled') AND league_id IS NULL) AS active_unmapped,
        count(*) FILTER (WHERE status IN ('live','scheduled') AND provider_league_id IS NULL) AS active_missing_provider_competition,
        count(*) FILTER (WHERE status IN ('live','scheduled') AND league_id IS NOT NULL) AS active_mapped
 FROM public.fan_live_games
), unreviewed AS (
 SELECT count(*) AS active_unverified_assignments
 FROM public.fan_live_games g
 LEFT JOIN public.fan_live_league_provider_map m
   ON m.provider_source = g.provider_source
  AND m.provider_league_id = g.provider_league_id
 WHERE g.status IN ('live','scheduled')
   AND g.league_id IS NOT NULL
   AND (m.league_id IS NULL OR m.league_id <> g.league_id)
), verified_maps AS (
 SELECT count(*) AS reviewed_mapping_count
 FROM public.fan_live_league_provider_map
), conflicts AS (
 SELECT count(*) AS conflicting_verified_mappings
 FROM public.fan_live_games g
 JOIN public.fan_live_league_provider_map m
   ON m.provider_source = g.provider_source
  AND m.provider_league_id = g.provider_league_id
 WHERE g.league_id IS NOT NULL AND g.league_id <> m.league_id
), windows AS (
 SELECT count(*) AS missing_season_windows
 FROM public.leagues
 WHERE season_start_month IS NULL OR season_start_day IS NULL
    OR season_end_month IS NULL OR season_end_day IS NULL
)
SELECT fixtures.*, verified_maps.reviewed_mapping_count,
       unreviewed.active_unverified_assignments,
       conflicts.conflicting_verified_mappings,
       windows.missing_season_windows,
       (fixtures.total_fixtures > 0
        AND fixtures.active_fixtures > 0
        AND fixtures.active_mapped > 0
        AND verified_maps.reviewed_mapping_count > 0
        AND fixtures.active_unmapped = 0
        AND fixtures.active_missing_provider_competition = 0
        AND unreviewed.active_unverified_assignments = 0
        AND conflicts.conflicting_verified_mappings = 0
        AND windows.missing_season_windows = 0) AS mapping_gate_passed
FROM fixtures CROSS JOIN unreviewed CROSS JOIN verified_maps CROSS JOIN conflicts CROSS JOIN windows;

-- Empty staging databases MUST NOT pass: require actual active fixtures and
-- at least one reviewed provider mapping, not just zero missing records.
-- A passing SQL gate does not replace authenticated mobile/desktop QA,
-- migration verification, or review of real competition calendars.
