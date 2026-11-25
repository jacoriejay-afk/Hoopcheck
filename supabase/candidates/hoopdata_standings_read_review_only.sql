-- REVIEW ONLY: private consistent input for projectAttestedStandings.
-- No public grants, publication, writes or provider requests.
BEGIN;
CREATE FUNCTION public.hoopdata_read_standings_review(p_league uuid,p_season text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $read$
 SELECT jsonb_build_object(
   'leagueActive',true,
   'mapping',jsonb_build_object('leagueId',m.league_id,'providerLeagueId',m.provider_league_id,'side',m.side,'reviewed',m.reviewed,'evidence',m.evidence),
   'mappingReviewedAt',to_char(m.reviewed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'snapshot',jsonb_build_object('leagueId',s.league_id,'providerLeagueId',s.provider_league_id,'season',s.season,'observedAt',to_char(s.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'rows',s.rows),
   'attestation',jsonb_build_object('leagueId',a.league_id,'providerLeagueId',a.provider_league_id,'season',a.season,'observedAt',to_char(a.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'mappingReviewedAt',to_char(a.mapping_reviewed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'reviewedAt',to_char(a.reviewed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'evidence',a.evidence,'snapshotRows',a.snapshot_rows,'reviewedRoster',a.reviewed_roster,'reviewedTeamIds',a.reviewed_team_ids),
   'teamMappings',COALESCE((SELECT jsonb_agg(jsonb_build_object('leagueId',tm.league_id,'providerLeagueId',tm.provider_league_id,'side',m.side,'providerTeamId',tm.provider_team_id,'teamId',tm.team_id,'reviewed',true) ORDER BY tm.provider_team_id)
     FROM public.hoopdata_standings_team_mappings tm JOIN public.teams t ON t.id=tm.team_id AND t.active AND t.league_id=m.league_id AND t.basketball_type=m.side
     WHERE tm.league_id=m.league_id AND tm.provider_league_id=m.provider_league_id),'[]'::jsonb),
   'providerStandingsSupported',true
 )
 FROM public.hoopdata_competition_mappings m
 JOIN public.leagues l ON l.id=m.league_id AND l.active AND l.basketball_type=m.side
 JOIN public.hoopdata_competition_snapshots s ON s.league_id=m.league_id AND s.provider_league_id=m.provider_league_id AND s.kind='standings' AND s.season=p_season
 JOIN public.hoopdata_standings_attestations a ON a.league_id=s.league_id AND a.provider_league_id=s.provider_league_id AND a.season=s.season AND a.observed_at=s.observed_at AND a.snapshot_rows=s.rows AND a.mapping_reviewed_at=m.reviewed_at
 JOIN public.hoopdata_competition_snapshots meta ON meta.league_id=m.league_id AND meta.provider_league_id=m.provider_league_id AND meta.kind='seasons' AND meta.season=''
 WHERE m.league_id=p_league AND m.reviewed AND m.reviewed_at<=s.observed_at
 AND s.observed_at BETWEEN statement_timestamp()-interval '1 hour' AND statement_timestamp()
 AND a.reviewed_at BETWEEN s.observed_at AND statement_timestamp()
 AND meta.observed_at BETWEEN statement_timestamp()-interval '24 hours' AND statement_timestamp()
 AND meta.observed_at>=m.reviewed_at
 AND (SELECT count(*) FROM jsonb_array_elements(meta.rows) x(r) WHERE r->>'season'=p_season)=1
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(meta.rows) x(r) WHERE r->>'season'=p_season AND r->'standings'='true'::jsonb)
 AND a.reviewed_team_ids=COALESCE((SELECT jsonb_object_agg(tm.provider_team_id::text,tm.team_id)
   FROM public.hoopdata_standings_team_mappings tm JOIN public.teams t ON t.id=tm.team_id AND t.active AND t.league_id=m.league_id AND t.basketball_type=m.side
   WHERE tm.league_id=m.league_id AND tm.provider_league_id=m.provider_league_id AND a.reviewed_team_ids ? tm.provider_team_id::text),'{}'::jsonb);
$read$;
REVOKE ALL ON FUNCTION public.hoopdata_read_standings_review(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoopdata_read_standings_review(uuid,text) TO service_role;
COMMIT;
