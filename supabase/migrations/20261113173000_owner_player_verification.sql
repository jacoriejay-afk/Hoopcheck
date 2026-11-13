-- Require an approved platform owner for player-verification decisions.
-- The existing admin-role check and all downstream behavior remain intact.
CREATE OR REPLACE FUNCTION public.moderate_player_verification(
  p_request_id uuid,
  p_status text,
  p_reviewer_note text DEFAULT NULL
)
RETURNS public.player_verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_request public.player_verification_requests;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR NOT hoopcheck_security.is_approved_owner() THEN
    RAISE EXCEPTION 'Approved owner access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = (SELECT auth.uid()) AND trim(lower(role)) = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins may approve player verification' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid verification status';
  END IF;
  UPDATE public.player_verification_requests
  SET status = p_status,
      reviewer_id = auth.uid(),
      reviewer_note = CASE WHEN p_reviewer_note IS NULL THEN reviewer_note ELSE left(trim(p_reviewer_note), 1000) END,
      reviewed_at = v_now
  WHERE id = p_request_id AND status = 'pending'
  RETURNING * INTO v_request;
  IF v_request.id IS NULL THEN RAISE EXCEPTION 'Pending verification request not found'; END IF;
  UPDATE public.profiles
  SET player_verified = (p_status = 'approved'),
      player_verified_at = CASE WHEN p_status = 'approved' THEN v_now ELSE NULL END,
      selected_team_id = CASE WHEN p_status = 'approved' THEN v_request.team_id ELSE selected_team_id END,
      selected_womens_team_id = CASE WHEN p_status = 'approved' THEN v_request.womens_team_id ELSE selected_womens_team_id END,
      selected_team_verified = CASE WHEN p_status = 'approved' AND (v_request.team_id IS NOT NULL OR v_request.womens_team_id IS NOT NULL) THEN true ELSE selected_team_verified END
  WHERE id = v_request.user_id;
  IF p_status = 'approved' AND v_request.team_id IS NOT NULL THEN
    INSERT INTO public.player_team_affiliations(user_id, team_id, relationship, start_date, verified, evidence_url)
    VALUES(v_request.user_id, v_request.team_id, 'current', current_date, true, v_request.evidence_url)
    ON CONFLICT(user_id, team_id) DO UPDATE
    SET relationship = 'current', verified = true, evidence_url = excluded.evidence_url, end_date = NULL;
  END IF;
  RETURN v_request;
END;
$function$;
