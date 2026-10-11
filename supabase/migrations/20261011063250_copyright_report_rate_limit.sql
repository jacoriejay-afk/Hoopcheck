-- Rate-limit public copyright notices and counter-notices without storing raw IP addresses.
CREATE TABLE IF NOT EXISTS public.copyright_report_rate_limits (
  key_hash text PRIMARY KEY CHECK (char_length(key_hash) = 64),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);
ALTER TABLE public.copyright_report_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.copyright_report_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.copyright_report_rate_limits TO service_role;

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
