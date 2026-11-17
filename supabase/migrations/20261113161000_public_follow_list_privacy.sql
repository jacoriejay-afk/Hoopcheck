-- Keep public follower discovery, but never disclose the followers of a private
-- player/fan profile to an unrelated anonymous or authenticated visitor.
-- This is deliberately narrow: team follower lists remain public.
CREATE OR REPLACE FUNCTION public.get_public_follow_list(
  p_mode text, p_target_type text DEFAULT NULL::text,
  p_target_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, target_type text, target_id uuid, display_name text,
              avatar_url text, account_type text, player_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT
    CASE WHEN p_mode = 'followers' THEN follower.id ELSE fr.target_id END,
    fr.target_type, fr.target_id,
    CASE WHEN p_mode = 'followers' THEN follower.display_name
      WHEN fr.target_type IN ('player','fan') THEN target_profile.display_name
      WHEN fr.target_type = 'team' THEN coalesce(team.name,womens_team.name)
      ELSE NULL END,
    CASE WHEN p_mode = 'followers' THEN follower.avatar_url
      ELSE coalesce(target_profile.avatar_url,team.logo_url,womens_team.logo_url) END,
    CASE WHEN p_mode = 'followers' THEN follower.account_type ELSE target_profile.account_type END,
    CASE WHEN p_mode = 'followers' THEN coalesce(follower.player_verified,false)
      ELSE coalesce(target_profile.player_verified,false) END
  FROM public.follow_relationships fr
  LEFT JOIN public.profiles follower ON follower.id = fr.follower_id
  LEFT JOIN public.profiles target_profile ON fr.target_type IN ('player','fan') AND target_profile.id=fr.target_id
  LEFT JOIN public.teams team ON fr.target_type='team' AND team.id=fr.target_id
  LEFT JOIN public.womens_teams womens_team ON fr.target_type='team' AND womens_team.id=fr.target_id
  WHERE (
    (p_mode='followers' AND fr.target_type=p_target_type AND fr.target_id=p_target_id)
    OR (p_mode='following' AND fr.follower_id=p_user_id
      AND (auth.uid()=p_user_id OR follower.profile_visibility='public'))
  )
  AND (
    (p_mode='followers' AND follower.profile_visibility='public')
    OR (p_mode='following' AND (fr.target_type='team'
      OR target_profile.profile_visibility='public' OR target_profile.id=auth.uid()))
  )
  AND (
    p_mode <> 'followers'
    OR p_target_type='team'
    OR (p_target_type IN ('player','fan') AND EXISTS (
      SELECT 1 FROM public.profiles requested
      WHERE requested.id=p_target_id
        AND (requested.profile_visibility='public' OR requested.id=auth.uid())
    ))
  )
  ORDER BY fr.created_at DESC;
$function$;
