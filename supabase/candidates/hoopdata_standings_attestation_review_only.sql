-- HOOPDATA-2C REVIEW ONLY. Private operator attestations; no public grants or writes.
BEGIN;
CREATE TABLE public.hoopdata_standings_team_mappings (
  league_id uuid NOT NULL REFERENCES public.hoopdata_competition_mappings(league_id),
  provider_league_id bigint NOT NULL CHECK(provider_league_id>0),
  provider_team_id bigint NOT NULL CHECK(provider_team_id>0),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  reviewed_by uuid NOT NULL REFERENCES public.profiles(id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 1 AND 2000),
  PRIMARY KEY(league_id,provider_league_id,provider_team_id),
  UNIQUE(league_id,provider_league_id,team_id)
);
CREATE TABLE public.hoopdata_standings_attestations (
  league_id uuid NOT NULL REFERENCES public.hoopdata_competition_mappings(league_id),
  provider_league_id bigint NOT NULL,
  season text NOT NULL CHECK(season ~ '^[0-9]{4}(-[0-9]{4})?$'),
  observed_at timestamptz NOT NULL,
  mapping_reviewed_at timestamptz NOT NULL,
  snapshot_rows jsonb NOT NULL CHECK(jsonb_typeof(snapshot_rows)='array'),
  reviewed_roster jsonb NOT NULL CHECK(jsonb_typeof(reviewed_roster)='array'),
  reviewed_team_ids jsonb NOT NULL CHECK(jsonb_typeof(reviewed_team_ids)='object'),
  reviewed_by uuid NOT NULL REFERENCES public.profiles(id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 1 AND 2000),
  PRIMARY KEY(league_id,provider_league_id,season,observed_at)
);
ALTER TABLE public.hoopdata_standings_team_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoopdata_standings_attestations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_standings_team_mappings,public.hoopdata_standings_attestations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.hoopdata_standings_team_mappings,public.hoopdata_standings_attestations TO service_role;

-- Only the database owner/operator can invoke this review candidate. Never accept a client-provided reviewer identity.
-- Caller supplies independently reviewed roster entries {teamId,stage,group}, and the exact snapshot seen.
-- An attestation is private audit evidence, not an ongoing authorization to publish.
CREATE FUNCTION public.hoopdata_attest_standings(p_league uuid,p_provider bigint,p_season text,p_observed timestamptz,p_rows jsonb,p_roster jsonb,p_reviewer uuid,p_evidence text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $review$
DECLARE
  m public.hoopdata_competition_mappings%ROWTYPE;
  s public.hoopdata_competition_snapshots%ROWTYPE;
  roster_actual jsonb;
  roster_expected jsonb;
  aliases jsonb;
  matched bigint;
  distinct_roster bigint;
BEGIN
  IF p_observed IS NULL OR p_observed>clock_timestamp() OR p_observed<clock_timestamp()-interval '1 hour'
    OR p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR p_roster IS NULL OR jsonb_typeof(p_roster)<>'array'
    OR p_reviewer IS NULL OR p_evidence IS NULL OR length(btrim(p_evidence)) NOT BETWEEN 1 AND 2000 THEN RETURN false; END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 10000 OR jsonb_array_length(p_rows)<>jsonb_array_length(p_roster) THEN RETURN false; END IF;
  SELECT * INTO m FROM public.hoopdata_competition_mappings WHERE league_id=p_league FOR UPDATE;
  IF NOT FOUND OR NOT m.reviewed OR m.provider_league_id IS DISTINCT FROM p_provider OR m.reviewed_at IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.leagues WHERE id=p_league AND active AND basketball_type=m.side) THEN RETURN false; END IF;
  SELECT * INTO s FROM public.hoopdata_competition_snapshots WHERE league_id=p_league AND kind='standings' AND season=p_season FOR UPDATE;
  IF NOT FOUND OR s.provider_league_id IS DISTINCT FROM p_provider OR s.observed_at IS DISTINCT FROM p_observed OR s.rows IS DISTINCT FROM p_rows THEN RETURN false; END IF;
  -- Reject malformed identities before casting; rank and statistic validation remain in the TS preparation gate.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows||p_roster) AS x(r)
    WHERE jsonb_typeof(r) IS DISTINCT FROM 'object' OR jsonb_typeof(r->'teamId') IS DISTINCT FROM 'number'
      OR coalesce(r->>'teamId','') !~ '^[1-9][0-9]{0,15}$'
      OR NOT (r ? 'stage' AND r ? 'group')
      OR jsonb_typeof(r->'stage') NOT IN ('string','null') OR jsonb_typeof(r->'group') NOT IN ('string','null')) THEN RETURN false; END IF;
  SELECT jsonb_agg(k ORDER BY k),count(DISTINCT k) INTO roster_actual,distinct_roster
    FROM (SELECT jsonb_build_array(r->'stage',r->'group',r->'teamId') AS k FROM jsonb_array_elements(p_rows) AS x(r)) q;
  SELECT jsonb_agg(k ORDER BY k) INTO roster_expected
    FROM (SELECT jsonb_build_array(r->'stage',r->'group',r->'teamId') AS k FROM jsonb_array_elements(p_roster) AS x(r)) q;
  IF roster_actual IS DISTINCT FROM roster_expected OR distinct_roster<>jsonb_array_length(p_rows) THEN RETURN false; END IF;
  SELECT count(*),jsonb_object_agg(a.provider_team_id::text,a.team_id) INTO matched,aliases
    FROM (SELECT DISTINCT (r->>'teamId')::bigint AS provider_team_id FROM jsonb_array_elements(p_rows) AS x(r)) ids
    JOIN public.hoopdata_standings_team_mappings a ON a.league_id=p_league AND a.provider_league_id=p_provider AND a.provider_team_id=ids.provider_team_id
    JOIN public.teams t ON t.id=a.team_id AND t.active AND t.league_id=p_league AND t.basketball_type=m.side;
  IF matched<>(SELECT count(DISTINCT r->>'teamId') FROM jsonb_array_elements(p_rows) AS x(r)) THEN RETURN false; END IF;
  INSERT INTO public.hoopdata_standings_attestations(league_id,provider_league_id,season,observed_at,mapping_reviewed_at,snapshot_rows,reviewed_roster,reviewed_team_ids,reviewed_by,evidence)
    VALUES(p_league,p_provider,p_season,p_observed,m.reviewed_at,p_rows,p_roster,aliases,p_reviewer,p_evidence)
    ON CONFLICT DO NOTHING;
  RETURN FOUND;
END;
$review$;
REVOKE ALL ON FUNCTION public.hoopdata_attest_standings(uuid,bigint,text,timestamptz,jsonb,jsonb,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
