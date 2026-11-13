-- SECURITY-FINAL #579: owner approval required for destructive directory admin RPC.
CREATE OR REPLACE FUNCTION public.admin_delete_directory_entry(p_type text, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_exists boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT hoopcheck_security.is_approved_owner()
    OR NOT EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = (SELECT auth.uid())
        AND lower(trim(coalesce(ar.role,''))) = 'admin'
    )
  THEN
    RAISE EXCEPTION 'Only approved owner administrators can delete directory entries'
      USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('coach','team','league') THEN RAISE EXCEPTION 'Invalid directory type'; END IF;
  IF p_type='coach' THEN
    SELECT EXISTS(SELECT 1 FROM public.coaches WHERE id=p_id) INTO v_exists;
    IF NOT v_exists THEN RAISE EXCEPTION 'Coach not found'; END IF;
    IF EXISTS(SELECT 1 FROM public.reviews WHERE coach_id=p_id) THEN
      RAISE EXCEPTION 'Cannot delete coach with reviews. Archive it instead.';
    END IF;
    DELETE FROM public.coaches WHERE id=p_id;
  ELSIF p_type='team' THEN
    SELECT EXISTS(SELECT 1 FROM public.teams WHERE id=p_id) INTO v_exists;
    IF NOT v_exists THEN RAISE EXCEPTION 'Team not found'; END IF;
    IF EXISTS(SELECT 1 FROM public.reviews WHERE team_id=p_id) THEN
      RAISE EXCEPTION 'Cannot delete team with reviews. Archive it instead.';
    END IF;
    DELETE FROM public.teams WHERE id=p_id;
  ELSE
    SELECT EXISTS(SELECT 1 FROM public.leagues WHERE id=p_id) INTO v_exists;
    IF NOT v_exists THEN RAISE EXCEPTION 'League not found'; END IF;
    DELETE FROM public.leagues WHERE id=p_id;
  END IF;
  RETURN true;
END;
$function$;

-- Confidential business inquiries must be owner-admin only.
CREATE OR REPLACE FUNCTION public.admin_list_public_business_inquiries(p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, name text, email text, type text, message text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT hoopcheck_security.is_approved_owner()
    OR NOT EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = (SELECT auth.uid())
        AND lower(trim(coalesce(ar.role,''))) = 'admin'
    )
  THEN
    RAISE EXCEPTION 'Approved owner admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Limit must be between 1 and 100' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT i.id, i.name, i.email, i.type, i.message, i.created_at
    FROM public.public_business_inquiries i
    ORDER BY i.created_at DESC, i.id DESC LIMIT p_limit;
END;
$function$;
