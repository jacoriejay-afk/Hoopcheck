-- Review only. Apply as one transaction after verifying the full effective PG17 schema.
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '15s';

DO $guard$
BEGIN
  IF to_regprocedure('public.confirm_active_account_session()') IS NULL
     OR to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NULL
     OR (SELECT count(*) FROM pg_class
         WHERE oid IN ('public.player_contact_requests'::regclass, 'public.player_contact_messages'::regclass)
           AND relrowsecurity) <> 2
     OR NOT EXISTS (
       SELECT 1 FROM pg_policy
       WHERE polrelid = 'public.player_contact_requests'::regclass
         AND polname = 'post16_contact_pair_block_guard' AND NOT polpermissive
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_policy
       WHERE polrelid = 'public.player_contact_messages'::regclass
         AND polname = 'post16_contact_message_block_guard' AND NOT polpermissive
     )
  THEN RAISE EXCEPTION 'Review live-session, MFA and bilateral contact guards first';
  END IF;
END
$guard$;

CREATE SCHEMA hoopcheck_chat_private;
REVOKE ALL ON SCHEMA hoopcheck_chat_private FROM PUBLIC;
GRANT USAGE ON SCHEMA hoopcheck_chat_private TO authenticated;

CREATE TABLE hoopcheck_chat_private.read_markers (
  reader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.player_contact_requests(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL,
  last_read_id uuid NOT NULL,
  PRIMARY KEY (reader_id, request_id)
);
CREATE INDEX hoopchat_read_markers_request_idx ON hoopcheck_chat_private.read_markers(request_id);
ALTER TABLE hoopcheck_chat_private.read_markers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE hoopcheck_chat_private.read_markers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE hoopcheck_chat_private.read_markers TO authenticated;
GRANT UPDATE (last_read_at, last_read_id) ON TABLE hoopcheck_chat_private.read_markers TO authenticated;

CREATE POLICY own_active_chat_marker
ON hoopcheck_chat_private.read_markers FOR ALL TO authenticated
USING (
  reader_id = (SELECT auth.uid())
  AND (SELECT public.confirm_active_account_session())
  AND (SELECT hoopcheck_security.mfa_satisfied())
  AND EXISTS (
    SELECT 1 FROM public.player_contact_requests r
    WHERE r.id = read_markers.request_id AND r.status = 'accepted'
      AND (SELECT auth.uid()) IN (r.requester_id, r.player_id)
  )
)
WITH CHECK (
  reader_id = (SELECT auth.uid())
  AND (SELECT public.confirm_active_account_session())
  AND (SELECT hoopcheck_security.mfa_satisfied())
  AND EXISTS (
    SELECT 1 FROM public.player_contact_messages m
    JOIN public.player_contact_requests r ON r.id = m.request_id
    WHERE m.request_id = read_markers.request_id AND m.id = read_markers.last_read_id
      AND m.created_at = read_markers.last_read_at AND m.sender_id <> (SELECT auth.uid())
      AND r.status = 'accepted' AND (SELECT auth.uid()) IN (r.requester_id, r.player_id)
  )
);

CREATE FUNCTION hoopcheck_chat_private.keep_latest_chat_marker()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF (new.last_read_at, new.last_read_id) <= (old.last_read_at, old.last_read_id) THEN
    RETURN NULL;
  END IF;
  RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION hoopcheck_chat_private.keep_latest_chat_marker() FROM PUBLIC;
CREATE TRIGGER monotonic_chat_read_marker
BEFORE UPDATE ON hoopcheck_chat_private.read_markers
FOR EACH ROW EXECUTE FUNCTION hoopcheck_chat_private.keep_latest_chat_marker();

-- The message SELECT respects participant, block, session and MFA policies.
CREATE FUNCTION public.mark_hoopchat_read(p_request_id uuid, p_message_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  viewer uuid := auth.uid();
  seen_at timestamptz;
BEGIN
  IF viewer IS NULL OR public.confirm_active_account_session() IS NOT TRUE
     OR hoopcheck_security.mfa_satisfied() IS NOT TRUE
  THEN RAISE EXCEPTION 'Verify the active account' USING ERRCODE = '42501';
  END IF;
  SELECT m.created_at INTO seen_at FROM public.player_contact_messages m
  JOIN public.player_contact_requests r ON r.id = m.request_id
  WHERE m.id = p_message_id AND m.request_id = p_request_id AND m.sender_id <> viewer
    AND r.status = 'accepted' AND viewer IN (r.requester_id, r.player_id);
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO hoopcheck_chat_private.read_markers AS current_marker
    (reader_id, request_id, last_read_at, last_read_id)
    VALUES (viewer, p_request_id, seen_at, p_message_id)
  ON CONFLICT (reader_id, request_id) DO UPDATE SET
    last_read_at = excluded.last_read_at, last_read_id = excluded.last_read_id
    WHERE (current_marker.last_read_at, current_marker.last_read_id)
      < (excluded.last_read_at, excluded.last_read_id);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_hoopchat_read(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_hoopchat_read(uuid, uuid) TO authenticated;

-- Return only viewer-visible threads. A result of 100 means 99+.
CREATE FUNCTION public.get_hoopchat_unread(p_request_ids uuid[])
RETURNS TABLE (request_id uuid, unread_count integer)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  viewer uuid := auth.uid();
BEGIN
  IF viewer IS NULL OR public.confirm_active_account_session() IS NOT TRUE
     OR hoopcheck_security.mfa_satisfied() IS NOT TRUE
  THEN RAISE EXCEPTION 'Verify the active account' USING ERRCODE = '42501';
  END IF;
  IF p_request_ids IS NULL OR cardinality(p_request_ids) > 100
  THEN RAISE EXCEPTION 'Invalid unread request' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT r.id,
    CASE WHEN r.status = 'pending' THEN 1 ELSE (
      SELECT count(*)::integer FROM (
        SELECT 1 FROM public.player_contact_messages m
        WHERE m.request_id = r.id AND m.sender_id <> viewer
          AND m.created_at >= coalesce(marker.last_read_at, '-infinity'::timestamptz)
          AND (marker.last_read_at IS NULL OR (m.created_at, m.id) > (marker.last_read_at, marker.last_read_id))
        LIMIT 100
      ) AS unread
    ) END
  FROM public.player_contact_requests r
  LEFT JOIN hoopcheck_chat_private.read_markers marker
    ON marker.reader_id = viewer AND marker.request_id = r.id
  WHERE r.id = ANY(p_request_ids) AND viewer IN (r.requester_id, r.player_id)
    AND (r.status = 'accepted' OR (r.status = 'pending' AND r.player_id = viewer));
END;
$$;
REVOKE ALL ON FUNCTION public.get_hoopchat_unread(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hoopchat_unread(uuid[]) TO authenticated;
