-- Add an append-only audit trail for privacy request workflow changes.
-- Avoid storing note contents in the event table; record only that notes changed.

CREATE TABLE IF NOT EXISTS public.privacy_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.privacy_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('created','status_changed','assigned','admin_notes_changed')),
  old_status text,
  new_status text,
  old_assigned_to uuid,
  new_assigned_to uuid,
  admin_notes_changed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS privacy_request_events_request_created_idx
  ON public.privacy_request_events (request_id, created_at DESC);

ALTER TABLE public.privacy_request_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "privacy request events admin read" ON public.privacy_request_events;
CREATE POLICY "privacy request events admin read"
  ON public.privacy_request_events
  FOR SELECT TO authenticated
  USING (public.is_current_user_admin_or_moderator());

REVOKE ALL ON public.privacy_request_events FROM anon, authenticated;
GRANT SELECT ON public.privacy_request_events TO authenticated;

CREATE OR REPLACE FUNCTION public.log_privacy_request_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.privacy_request_events
      (request_id, actor_id, event_type, new_status, new_assigned_to)
    VALUES
      (NEW.id, auth.uid(), 'created', NEW.status, NEW.assigned_to);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.privacy_request_events
      (request_id, actor_id, event_type, old_status, new_status)
    VALUES
      (NEW.id, auth.uid(), 'status_changed', OLD.status, NEW.status);
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.privacy_request_events
      (request_id, actor_id, event_type, old_assigned_to, new_assigned_to)
    VALUES
      (NEW.id, auth.uid(), 'assigned', OLD.assigned_to, NEW.assigned_to);
  END IF;

  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    INSERT INTO public.privacy_request_events
      (request_id, actor_id, event_type, admin_notes_changed)
    VALUES
      (NEW.id, auth.uid(), 'admin_notes_changed', true);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_privacy_request_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS privacy_request_event_log ON public.privacy_requests;
CREATE TRIGGER privacy_request_event_log
  AFTER INSERT OR UPDATE OF status, assigned_to, admin_notes
  ON public.privacy_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_privacy_request_event();
