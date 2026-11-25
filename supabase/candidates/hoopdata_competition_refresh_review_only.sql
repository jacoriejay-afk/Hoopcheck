-- HOOPDATA-2B2 REVIEW ONLY. Isolated queue rehearsal; do not apply to production.
BEGIN;
CREATE TABLE public.hoopdata_competition_refresh_jobs (
  league_id uuid NOT NULL REFERENCES public.hoopdata_competition_mappings(league_id),
  kind text NOT NULL CHECK(kind IN ('seasons','games','standings')),
  enabled boolean NOT NULL DEFAULT false,
  next_due_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_state text CHECK(last_state IN ('staged','deferred','failed')),
  PRIMARY KEY(league_id,kind),
  CHECK((lease_token IS NULL)=(lease_until IS NULL))
);
ALTER TABLE public.hoopdata_competition_refresh_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_competition_refresh_jobs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.hoopdata_competition_refresh_jobs TO service_role;
GRANT UPDATE(next_due_at,lease_token,lease_until,last_attempt_at,last_success_at,last_state) ON public.hoopdata_competition_refresh_jobs TO service_role;
-- No seeded or enabled jobs. A DB operator must explicitly opt in each reviewed league.
-- Each tick takes at most one lease; concurrent ticks cannot claim the same job.
CREATE FUNCTION public.hoopdata_claim_competition_refresh()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $claim$
DECLARE j public.hoopdata_competition_refresh_jobs%ROWTYPE;
        m public.hoopdata_competition_mappings%ROWTYPE;
        t timestamptz:=clock_timestamp();
        season_rows jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.hoopdata_quota_pools q WHERE q.pool='api-sports-basketball' AND q.enabled AND (q.blocked_until IS NULL OR q.blocked_until<=t)) THEN RETURN NULL; END IF;
  SELECT r.* INTO j FROM public.hoopdata_competition_refresh_jobs r
  JOIN public.hoopdata_competition_mappings a ON a.league_id=r.league_id
  JOIN public.leagues l ON l.id=r.league_id
  WHERE r.enabled AND a.reviewed AND l.active AND l.basketball_type=a.side
    AND r.next_due_at<=t AND (r.lease_until IS NULL OR r.lease_until<=t)
  ORDER BY r.next_due_at,CASE r.kind WHEN 'seasons' THEN 0 WHEN 'games' THEN 1 ELSE 2 END,r.league_id
  LIMIT 1 FOR UPDATE OF r SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO m FROM public.hoopdata_competition_mappings WHERE league_id=j.league_id;
  UPDATE public.hoopdata_competition_refresh_jobs
    SET lease_token=gen_random_uuid(),lease_until=t+interval '2 minutes',last_attempt_at=t
    WHERE league_id=j.league_id AND kind=j.kind RETURNING * INTO j;
  IF j.kind<>'seasons' THEN
    SELECT s.rows INTO season_rows FROM public.hoopdata_competition_snapshots s
    WHERE s.league_id=j.league_id AND s.provider_league_id=m.provider_league_id AND s.kind='seasons'
      AND s.season='' AND s.observed_at>=t-interval '48 hours' AND s.observed_at<=t;
  END IF;
  RETURN jsonb_build_object('leagueId',j.league_id,'kind',j.kind,'leaseToken',j.lease_token,
    'mapping',jsonb_build_object('leagueId',m.league_id,'providerLeagueId',m.provider_league_id,'side',m.side,'reviewed',m.reviewed,'evidence',m.evidence),
    'seasonRows',season_rows);
END;
$claim$;
CREATE FUNCTION public.hoopdata_finish_competition_refresh(p_league uuid,p_kind text,p_token uuid,p_state text,p_retry_at timestamptz DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $finish$
DECLARE t timestamptz:=clock_timestamp();
BEGIN
  IF p_state IS NULL OR p_state NOT IN ('staged','deferred','failed') OR p_token IS NULL THEN RETURN false; END IF;
  UPDATE public.hoopdata_competition_refresh_jobs
    SET lease_token=NULL,lease_until=NULL,last_state=p_state,
    last_success_at=CASE WHEN p_state='staged' THEN t ELSE last_success_at END,
    next_due_at=CASE WHEN p_state='staged' THEN t+CASE p_kind WHEN 'seasons' THEN interval '24 hours' WHEN 'games' THEN interval '15 minutes' ELSE interval '1 hour' END
      ELSE greatest(t+interval '15 minutes',coalesce(p_retry_at,t)) END
    WHERE league_id=p_league AND kind=p_kind AND lease_token=p_token AND lease_until>t;
  RETURN FOUND;
END;
$finish$;
REVOKE ALL ON FUNCTION public.hoopdata_claim_competition_refresh(),public.hoopdata_finish_competition_refresh(uuid,text,uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hoopdata_claim_competition_refresh(),public.hoopdata_finish_competition_refresh(uuid,text,uuid,text,timestamptz) TO service_role;

-- Guard the actual snapshot write as well as the final job acknowledgement.
-- The locked job row prevents lease reassignment until the snapshot transaction ends.
CREATE FUNCTION public.hoopdata_stage_leased_competition_snapshot(p_league uuid,p_kind text,p_token uuid,p_provider bigint,p_side text,p_season text,p_observed timestamptz,p_rows jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $leased_stage$
BEGIN
  PERFORM 1 FROM public.hoopdata_competition_refresh_jobs
    WHERE league_id=p_league AND kind=p_kind AND enabled AND lease_token=p_token
      AND lease_until>clock_timestamp() AND p_observed>=last_attempt_at
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN public.hoopdata_stage_competition_snapshot(p_league,p_provider,p_side,p_kind,p_season,p_observed,p_rows);
END;
$leased_stage$;
REVOKE ALL ON FUNCTION public.hoopdata_stage_leased_competition_snapshot(uuid,text,uuid,bigint,text,text,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hoopdata_stage_leased_competition_snapshot(uuid,text,uuid,bigint,text,text,timestamptz,jsonb) TO service_role;
COMMIT;
