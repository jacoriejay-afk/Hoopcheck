-- SECURITY-FINAL #579: owner-only access to platform role directory.
-- Preserve existing function signature and output columns.
-- Deliberately do not change membership, moderator moderation, or Stripe logic.
CREATE OR REPLACE FUNCTION public.admin_list_user_roles(p_query text DEFAULT NULL::text)
RETURNS TABLE(id uuid, email text, display_name text, username text, role text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR NOT hoopcheck_security.is_approved_owner()
     OR NOT EXISTS (
       SELECT 1 FROM public.admin_roles ar
       WHERE ar.user_id = (SELECT auth.uid())
         AND lower(trim(coalesce(ar.role, ''))) = 'admin'
     )
  THEN
    RAISE EXCEPTION 'Only approved owner admins can manage role assignments'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, u.email::text, p.display_name, p.username,
    (SELECT lower(trim(ar.role))
     FROM public.admin_roles ar
     WHERE ar.user_id = p.id
       AND lower(trim(coalesce(ar.role, ''))) IN ('admin','moderator')
     ORDER BY CASE WHEN lower(trim(ar.role))='admin' THEN 0 ELSE 1 END
     LIMIT 1) AS role,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p_query IS NULL OR trim(p_query) = ''
     OR lower(coalesce(u.email, '')) LIKE '%' || lower(trim(p_query)) || '%'
     OR lower(coalesce(p.username, '')) LIKE '%' || lower(trim(p_query)) || '%'
     OR lower(coalesce(p.display_name, '')) LIKE '%' || lower(trim(p_query)) || '%'
  ORDER BY p.created_at DESC
  LIMIT 500;
END;
$function$;
