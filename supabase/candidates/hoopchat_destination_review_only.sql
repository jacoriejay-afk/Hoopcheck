-- Review-only. Run in a disposable database before schema acceptance.
-- A destination lookup exposes an accepted conversation only to a current,
-- unblocked participant. It returns the same empty result for every denial.
BEGIN;

CREATE FUNCTION public.resolve_hoopchat_destination(p_request_id uuid)
RETURNS TABLE(id uuid, requester_id uuid, player_id uuid, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT r.id, r.requester_id, r.player_id, r.status::text, r.created_at
  FROM public.player_contact_requests AS r
  CROSS JOIN (SELECT auth.uid() AS uid) AS caller
  WHERE r.id = p_request_id AND r.status = 'accepted'
    AND caller.uid IN (r.requester_id, r.player_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks AS b
      WHERE (b.blocker_id = r.requester_id AND b.blocked_id = r.player_id)
         OR (b.blocker_id = r.player_id AND b.blocked_id = r.requester_id)
    );
$function$;

REVOKE ALL ON FUNCTION public.resolve_hoopchat_destination(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_hoopchat_destination(uuid) TO authenticated;
COMMIT;
