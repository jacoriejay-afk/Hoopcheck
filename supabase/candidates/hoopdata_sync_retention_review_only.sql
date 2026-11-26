-- REVIEW ONLY: apply after snapshot, refresh and standings-attestation candidates in disposable rehearsal.
BEGIN;
ALTER TABLE public.hoopdata_competition_snapshots ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz;
ALTER TABLE public.hoopdata_standings_attestations ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz;
CREATE INDEX hoopdata_snapshots_expiry ON public.hoopdata_competition_snapshots(retention_expires_at) WHERE retention_expires_at IS NOT NULL;
CREATE INDEX hoopdata_attestations_expiry ON public.hoopdata_standings_attestations(retention_expires_at) WHERE retention_expires_at IS NOT NULL;
GRANT DELETE ON public.hoopdata_competition_snapshots,public.hoopdata_standings_attestations TO service_role;
-- Overload with a mandatory expiry argument for the licensed recurring preview worker.
-- The trusted server caller verifies actual legal grants before fetching and again before staging.
CREATE FUNCTION public.hoopdata_stage_leased_competition_snapshot(p_league uuid,p_kind text,p_token uuid,p_provider bigint,p_side text,p_season text,p_observed timestamptz,p_rows jsonb,p_retention_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $retention$
DECLARE m public.hoopdata_competition_mappings%ROWTYPE; t timestamptz:=clock_timestamp(); ttl interval;
BEGIN
 ttl:=CASE p_kind WHEN 'seasons' THEN interval '48 hours' WHEN 'games' THEN interval '24 hours' WHEN 'standings' THEN interval '1 hour' ELSE NULL END;
 IF ttl IS NULL OR p_observed IS NULL OR p_observed>t OR p_retention_expires_at IS NULL OR p_retention_expires_at<>p_observed+ttl OR p_retention_expires_at<=t
 OR p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR p_season IS NULL THEN RETURN false; END IF;
 IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 10000 OR (p_kind='seasons' AND p_season<>'') OR (p_kind<>'seasons' AND p_season !~ '^[0-9]{4}(-[0-9]{4})?$') THEN RETURN false; END IF;
 PERFORM 1 FROM public.hoopdata_competition_refresh_jobs WHERE league_id=p_league AND kind=p_kind AND enabled AND lease_token=p_token
 AND lease_until>clock_timestamp() AND p_observed>=last_attempt_at FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO m FROM public.hoopdata_competition_mappings WHERE league_id=p_league FOR UPDATE;
 IF NOT FOUND OR NOT m.reviewed OR m.provider_league_id IS DISTINCT FROM p_provider OR m.side IS DISTINCT FROM p_side THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.leagues l WHERE l.id=p_league AND l.active AND l.basketball_type=p_side) THEN RETURN false; END IF;
 INSERT INTO public.hoopdata_competition_snapshots(league_id,provider_league_id,kind,season,observed_at,retention_expires_at,rows)
 VALUES(p_league,p_provider,p_kind,p_season,p_observed,p_retention_expires_at,p_rows)
 ON CONFLICT(league_id,kind,season) DO UPDATE SET provider_league_id=excluded.provider_league_id,observed_at=excluded.observed_at,retention_expires_at=excluded.retention_expires_at,rows=excluded.rows
 WHERE public.hoopdata_competition_snapshots.observed_at<excluded.observed_at;
 RETURN FOUND;
END;
$retention$;
CREATE FUNCTION public.hoopdata_purge_expired_competition_snapshots()
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $purge$
DECLARE t timestamptz:=clock_timestamp();
BEGIN
 DELETE FROM public.hoopdata_standings_attestations a WHERE a.retention_expires_at<=t AND (a.league_id,a.provider_league_id,a.season,a.observed_at) IN (
 SELECT league_id,provider_league_id,season,observed_at FROM public.hoopdata_standings_attestations
 WHERE retention_expires_at<=t ORDER BY retention_expires_at LIMIT 100);
 DELETE FROM public.hoopdata_competition_snapshots s WHERE s.retention_expires_at<=t AND (s.league_id,s.kind,s.season) IN (
 SELECT league_id,kind,season FROM public.hoopdata_competition_snapshots WHERE retention_expires_at<=t ORDER BY retention_expires_at LIMIT 100);
 RETURN NOT EXISTS(SELECT 1 FROM public.hoopdata_standings_attestations WHERE retention_expires_at<=t)
 AND NOT EXISTS(SELECT 1 FROM public.hoopdata_competition_snapshots WHERE retention_expires_at<=t);
END;
$purge$;
REVOKE ALL ON FUNCTION public.hoopdata_stage_leased_competition_snapshot(uuid,text,uuid,bigint,text,text,timestamptz,jsonb,timestamptz),public.hoopdata_purge_expired_competition_snapshots() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoopdata_stage_leased_competition_snapshot(uuid,text,uuid,bigint,text,text,timestamptz,jsonb,timestamptz),public.hoopdata_purge_expired_competition_snapshots() TO service_role;
COMMIT;
