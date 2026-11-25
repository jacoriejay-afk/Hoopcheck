-- HOOPDATA-1 REVIEW ONLY. Do not execute on a deployed database.
-- No enabled quotas are seeded. All callers must reserve BEFORE each actual HTTP attempt.
BEGIN;
CREATE TABLE public.hoopdata_quota_pools (
  pool text PRIMARY KEY CHECK (pool IN ('api-sports-basketball','balldontlie')),
  enabled boolean NOT NULL DEFAULT false,
  max_per_minute integer NOT NULL CHECK (max_per_minute BETWEEN 1 AND 5),
  max_per_day integer NOT NULL CHECK (max_per_day BETWEEN 1 AND 1000),
  blocked_until timestamptz
);
CREATE TABLE public.hoopdata_request_reservations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pool text NOT NULL REFERENCES public.hoopdata_quota_pools(pool),
  reserved_at timestamptz NOT NULL
);
CREATE INDEX hoopdata_request_reservations_pool_time ON public.hoopdata_request_reservations(pool,reserved_at);
ALTER TABLE public.hoopdata_quota_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoopdata_request_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_quota_pools,public.hoopdata_request_reservations FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.hoopdata_request_reservations_id_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.hoopdata_quota_pools,public.hoopdata_request_reservations TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.hoopdata_request_reservations_id_seq TO service_role;
-- A row lock serializes every reservation in a shared credential pool. Sliding
-- windows avoid a burst across a calendar minute/day boundary. No refund on HTTP failure.
CREATE FUNCTION public.hoopdata_reserve_request(p_pool text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  cfg public.hoopdata_quota_pools%ROWTYPE;
  observed timestamptz;
  minute_used bigint;
  day_used bigint;
BEGIN
  SELECT * INTO cfg FROM public.hoopdata_quota_pools WHERE pool=p_pool FOR UPDATE;
  IF NOT FOUND OR NOT cfg.enabled THEN RETURN false; END IF;
  observed := clock_timestamp();
  IF cfg.blocked_until IS NOT NULL AND cfg.blocked_until > observed THEN RETURN false; END IF;
  SELECT count(*) FILTER (WHERE reserved_at > observed - interval '1 minute'),count(*)
    INTO minute_used,day_used FROM public.hoopdata_request_reservations
    WHERE pool=p_pool AND reserved_at > observed - interval '24 hours';
  IF minute_used >= cfg.max_per_minute OR day_used >= cfg.max_per_day THEN RETURN false; END IF;
  INSERT INTO public.hoopdata_request_reservations(pool,reserved_at) VALUES(p_pool,observed);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.hoopdata_reserve_request(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hoopdata_reserve_request(text) TO service_role;
-- A later retry response cannot shorten a cooldown already persisted by another worker.
CREATE FUNCTION public.hoopdata_block_provider(p_pool text,p_until timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $
BEGIN
  IF p_until IS NULL OR p_until <= clock_timestamp() THEN RETURN false; END IF;
  UPDATE public.hoopdata_quota_pools
    SET blocked_until=greatest(blocked_until,p_until)
    WHERE pool=p_pool AND enabled;
  RETURN FOUND;
END;
$;
REVOKE ALL ON FUNCTION public.hoopdata_block_provider(text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hoopdata_block_provider(text,timestamptz) TO service_role;
COMMIT;
