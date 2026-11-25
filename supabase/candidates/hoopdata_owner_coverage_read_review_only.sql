-- REVIEW ONLY. Read-only data, service role only; no provider calls or production migration.
BEGIN;
CREATE FUNCTION public.hoopdata_read_owner_coverage_page(p_side text,p_after uuid,p_limit integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $coverage$
 WITH page AS MATERIALIZED (
   SELECT id,name,country,basketball_type,active FROM public.leagues
   WHERE p_side IN ('mens','womens') AND basketball_type=p_side AND active
     AND (p_after IS NULL OR id>p_after)
   ORDER BY id LIMIT CASE WHEN p_limit BETWEEN 1 AND 40 THEN p_limit+1 ELSE 0 END
 ), visible AS (
   SELECT * FROM page ORDER BY id LIMIT CASE WHEN p_limit BETWEEN 1 AND 40 THEN p_limit ELSE 0 END
 ), season_evidence AS (
   SELECT s.* FROM public.hoopdata_competition_snapshots s JOIN visible v ON v.id=s.league_id
   WHERE s.kind='seasons' AND s.season='' AND jsonb_array_length(s.rows)<=150
 ), observations AS (
   SELECT s.league_id,s.provider_league_id,s.season,s.kind,s.observed_at,jsonb_array_length(s.rows) AS row_count
   FROM public.hoopdata_competition_snapshots s JOIN season_evidence e ON e.league_id=s.league_id AND e.provider_league_id=s.provider_league_id
   WHERE s.kind IN ('games','standings') AND EXISTS(
     SELECT 1 FROM jsonb_array_elements(e.rows) x(r)
     WHERE r->>'season'=s.season
       AND r->>'start'<=to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD')
       AND r->>'end'>=to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD')
   )
 )
 SELECT CASE WHEN p_side IN ('mens','womens') AND p_limit BETWEEN 1 AND 40 THEN jsonb_build_object(
   'leagues',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'country',v.country,'side',v.basketball_type,'active',v.active) ORDER BY v.id) FROM visible v),'[]'::jsonb),
   'mappings',coalesce((SELECT jsonb_agg(jsonb_build_object('leagueId',m.league_id,'providerLeagueId',m.provider_league_id,'side',m.side,'reviewed',m.reviewed,'reviewedAt',m.reviewed_at,'evidence',m.evidence)) FROM public.hoopdata_competition_mappings m JOIN visible v ON v.id=m.league_id),'[]'::jsonb),
   'seasons',coalesce((SELECT jsonb_agg(jsonb_build_object('leagueId',s.league_id,'providerLeagueId',s.provider_league_id,'observedAt',s.observed_at,'rows',s.rows)) FROM season_evidence s),'[]'::jsonb),
   'observations',coalesce((SELECT jsonb_agg(jsonb_build_object('leagueId',s.league_id,'providerLeagueId',s.provider_league_id,'season',s.season,'kind',s.kind,'observedAt',s.observed_at,'rowCount',s.row_count)) FROM observations s),'[]'::jsonb),
   'nextCursor',CASE WHEN (SELECT count(*) FROM page)>p_limit THEN (SELECT id FROM visible ORDER BY id DESC LIMIT 1) ELSE NULL END,
   'quotas',coalesce((SELECT jsonb_agg(jsonb_build_object('pool',q.pool,'enabled',q.enabled,'minuteLimit',q.max_per_minute,'dayLimit',q.max_per_day,'blockedUntil',q.blocked_until,
     'minuteUsed',(SELECT count(*) FROM public.hoopdata_request_reservations r WHERE r.pool=q.pool AND r.reserved_at>statement_timestamp()-interval '1 minute'),
     'dayUsed',(SELECT count(*) FROM public.hoopdata_request_reservations r WHERE r.pool=q.pool AND r.reserved_at>statement_timestamp()-interval '24 hours')) ORDER BY q.pool) FROM public.hoopdata_quota_pools q),'[]'::jsonb)
 ) ELSE NULL END;
$coverage$;
REVOKE ALL ON FUNCTION public.hoopdata_read_owner_coverage_page(text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoopdata_read_owner_coverage_page(text,uuid,integer) TO service_role;
COMMIT;
