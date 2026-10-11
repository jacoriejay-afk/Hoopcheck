-- HoopCheck launch security hardening: reduce API-role grants and close direct moderation updates.
-- RLS controls rows, but it does not protect against TRUNCATE/REFERENCES/TRIGGER privileges.

REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- These tables contain private reports or moderation data and are not public directory data.
REVOKE ALL PRIVILEGES ON TABLE
  public.copyright_reports,
  public.privacy_requests,
  public.review_comments,
  public.review_likes,
  public.review_reports,
  public.support_requests,
  public.support_tickets,
  public.support_ticket_messages
FROM PUBLIC, anon, authenticated;

-- Keep only the table operations the current UI and RLS policies require.
GRANT SELECT, UPDATE ON TABLE public.copyright_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.privacy_requests TO authenticated;
GRANT SELECT, INSERT ON TABLE public.review_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.review_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.review_reports TO authenticated;
GRANT SELECT, INSERT ON TABLE public.support_requests TO authenticated;
GRANT SELECT, INSERT ON TABLE public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON TABLE public.support_ticket_messages TO authenticated;

-- Comment authors may submit comments, but must never set their own moderation status.
DROP POLICY IF EXISTS "review comments own update" ON public.review_comments;

-- Ticket status changes must be made through a moderator-checked function, not direct row updates.
DROP POLICY IF EXISTS "ticket owner update" ON public.support_tickets;

CREATE OR REPLACE FUNCTION public.admin_update_support_ticket(
  p_ticket_id uuid,
  p_status text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_admin_or_moderator() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Invalid support ticket status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.support_tickets
  SET status = p_status,
      updated_at = now(),
      resolved_at = CASE WHEN p_status IN ('resolved', 'closed') THEN now() ELSE NULL END
  WHERE id = p_ticket_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_support_ticket(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_support_ticket(uuid, text) TO authenticated;
