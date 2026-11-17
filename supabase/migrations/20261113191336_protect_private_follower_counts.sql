-- Match the existing private-profile follower-list boundary.
CREATE OR REPLACE FUNCTION public.get_follow_count(p_target_type text, p_target_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT count(*)::bigint
  FROM public.follow_relationships AS follow
  WHERE follow.target_type = p_target_type
    AND follow.target_id = p_target_id
    AND (
      p_target_type NOT IN ('player', 'fan')
      OR EXISTS (
        SELECT 1 FROM public.profiles AS target
        WHERE target.id = p_target_id
          AND (target.profile_visibility = 'public' OR target.id = (SELECT auth.uid()))
      )
    );
$function$;
REVOKE ALL ON FUNCTION public.get_follow_count(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_count(text, uuid) TO authenticated, service_role;
