-- Document service-role-only access and prune stale hashed rate-limit keys.
CREATE POLICY "service role manages copyright rate limits"
ON public.copyright_report_rate_limits
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS copyright_report_rate_limits_window_idx
ON public.copyright_report_rate_limits(window_started_at);

CREATE OR REPLACE FUNCTION public.consume_copyright_report_rate_limit(p_key_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid rate-limit key' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.copyright_report_rate_limits
  WHERE window_started_at < now() - interval '7 days';

  INSERT INTO public.copyright_report_rate_limits(key_hash, window_started_at, request_count)
  VALUES (p_key_hash, now(), 1)
  ON CONFLICT (key_hash) DO UPDATE
  SET window_started_at = CASE
        WHEN public.copyright_report_rate_limits.window_started_at < now() - interval '1 hour' THEN now()
        ELSE public.copyright_report_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN public.copyright_report_rate_limits.window_started_at < now() - interval '1 hour' THEN 1
        ELSE public.copyright_report_rate_limits.request_count + 1
      END
  RETURNING request_count INTO v_count;

  RETURN v_count <= 10;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_copyright_report_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_copyright_report_rate_limit(text) TO service_role;
