-- Harden existing shared follower RPC without changing caller contract or grants.
DO $guard$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_proc p
  WHERE p.oid=to_regprocedure('public.get_shared_team_followers(uuid)')
    AND md5(p.prosrc)='76a6446a0e8ac8067cd9cd2e1abce702'
    AND p.prosecdef AND p.provolatile='s'
    AND pg_get_userbyid(p.proowner)='postgres'
 ) THEN RAISE EXCEPTION 'Shared followers RPC drift; review before applying'; END IF;
END
$guard$;
CREATE OR REPLACE FUNCTION public.get_shared_team_followers(p_team_id uuid)
 RETURNS TABLE(display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select distinct follower.display_name
  from public.follow_relationships mine
  join public.follow_relationships team_follow
    on team_follow.follower_id = mine.target_id
   and team_follow.target_type = 'team'
   and team_follow.target_id = p_team_id
  join public.profiles follower on follower.id = mine.target_id
  where mine.follower_id = auth.uid()
    and mine.target_type = 'player'
    and follower.account_type = 'player'
    and follower.profile_visibility = 'public'
    and follower.moderation_status is distinct from 'suspended'
    and follower.display_name is not null
  order by follower.display_name
  limit 3;
$function$;
