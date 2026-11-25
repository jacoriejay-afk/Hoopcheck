-- REVIEW ONLY: do not apply to production. Validate the installed schema,
-- role grants and API exposed schemas before preparing a versioned migration.
-- This dedicated schema must not be exposed through PostgREST.
-- Caller owns the TARGET, not the outgoing relationship. Do not widen table RLS.
create schema hoopcheck_follower_internal;
revoke all on schema hoopcheck_follower_internal from public, anon, authenticated, service_role;
grant usage on schema hoopcheck_follower_internal to authenticated;

create function hoopcheck_follower_internal.remove_own_follower(p_follower_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid := auth.uid();
  v_type text;
begin
  if v_owner is null or p_follower_id is null or p_follower_id = v_owner
     or coalesce(auth.jwt()->>'is_anonymous','false') = 'true' then
    raise exception 'Follower action not permitted' using errcode = '42501';
  end if;

  -- Derive the target type from the authoritative profile, never client input.
  select p.account_type into v_type from public.profiles p
  where p.id = v_owner and p.account_type in ('player','fan')
    and p.moderation_status = 'normal';

  if v_type is null then
    raise exception 'Follower action not permitted' using errcode = '42501';
  end if;

  delete from public.follow_relationships fr
   where fr.target_id = v_owner
     and fr.target_type = v_type
     and fr.follower_id = p_follower_id;
  -- Idempotent: absence and removal have identical return values.
  -- No private follower identity, count or relationship metadata is returned.
end;
$function$;
revoke all on function hoopcheck_follower_internal.remove_own_follower(uuid) from public, anon, authenticated, service_role;
grant execute on function hoopcheck_follower_internal.remove_own_follower(uuid) to authenticated;

create function public.remove_own_follower(p_follower_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select hoopcheck_follower_internal.remove_own_follower(p_follower_id);
$function$;
revoke all on function public.remove_own_follower(uuid) from public, anon, authenticated, service_role;
grant execute on function public.remove_own_follower(uuid) to authenticated;
