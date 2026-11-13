-- Do not expose private profiles' following counts to other viewers.
CREATE OR REPLACE FUNCTION public.get_public_following_count(p_user_id uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)
  from public.follow_relationships fr
  left join public.profiles owner_profile on owner_profile.id = p_user_id
  left join public.profiles target_profile on fr.target_type in ('player','fan') and target_profile.id = fr.target_id
  where fr.follower_id = p_user_id
    and (auth.uid() = p_user_id or owner_profile.profile_visibility = 'public')
    and (
      auth.uid() = p_user_id
      or fr.target_type = 'team'
      or target_profile.profile_visibility = 'public'
    );
$function$;