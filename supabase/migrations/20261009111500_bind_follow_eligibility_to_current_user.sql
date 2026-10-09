-- Prevent callers from probing whether arbitrary profile IDs exist.
-- Follow eligibility is only evaluated for the signed-in user's own profile.
create or replace function public.can_user_follow_target(p_user_id uuid, p_target_type text, p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and p_user_id = (select auth.uid())
    and p_target_type in ('team', 'player', 'league')
    and p_target_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
    );
$function$;

revoke execute on function public.can_user_follow_target(uuid, text, uuid) from public, anon;
grant execute on function public.can_user_follow_target(uuid, text, uuid) to authenticated, service_role;
