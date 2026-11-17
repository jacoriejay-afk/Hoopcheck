-- SHARE-1: serialize per-sender delivery and enforce rate limits atomically.
-- Callable only with the server-side service role; never grant to browser roles.
CREATE OR REPLACE FUNCTION public.hoopfeed_send_share_atomic(
  p_post_id uuid, p_sender_id uuid, p_recipient_id uuid
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE recent_count integer;
BEGIN
  IF p_post_id IS NULL OR p_sender_id IS NULL OR p_recipient_id IS NULL OR p_sender_id = p_recipient_id THEN
    RETURN 'invalid';
  END IF;
  -- A sender-specific transaction lock serializes concurrent sends across workers.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_sender_id::text, 38191));
  IF EXISTS (SELECT 1 FROM public.hoopfeed_post_shares
             WHERE post_id=p_post_id AND sender_id=p_sender_id AND recipient_id=p_recipient_id) THEN
    RETURN 'duplicate';
  END IF;
  SELECT count(*) INTO recent_count FROM public.hoopfeed_post_shares
    WHERE sender_id=p_sender_id AND created_at >= pg_catalog.now() - interval '1 minute';
  IF recent_count >= 5 THEN RETURN 'rate_limited'; END IF;
  INSERT INTO public.hoopfeed_post_shares(post_id,sender_id,recipient_id)
    VALUES(p_post_id,p_sender_id,p_recipient_id);
  RETURN 'sent';
END;
$$;
REVOKE ALL ON FUNCTION public.hoopfeed_send_share_atomic(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hoopfeed_send_share_atomic(uuid,uuid,uuid) TO service_role;
