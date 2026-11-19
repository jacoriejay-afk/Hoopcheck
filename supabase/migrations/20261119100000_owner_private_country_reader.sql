-- Build 8 candidate migration: owner-only country reader.
-- Draft only. Do not apply before client compatibility and full security review.
-- Does NOT revoke any existing column privileges.
CREATE OR REPLACE FUNCTION public.get_my_private_country()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.current_country
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.get_my_private_country() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_private_country() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_private_country() TO authenticated;

COMMENT ON FUNCTION public.get_my_private_country() IS
  'Returns the signed-in users own current_country; does not expose other profiles. Client migration prerequisite to restricting direct SELECT.';
