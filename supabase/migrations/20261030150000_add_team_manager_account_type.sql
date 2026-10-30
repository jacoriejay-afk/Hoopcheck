-- Add a dedicated team-manager role and restrict team/profile claims to coaches and managers.
-- Preserve existing signup validation and privileged profile-field protections.

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.handle_new_user()'::regprocedure) into definition;
  definition := replace(
    definition,
    'account_type_value NOT IN (''player'', ''coach'', ''scout'', ''agent'', ''fan'')',
    "account_type_value NOT IN ('player', 'coach', 'manager', 'scout', 'agent', 'fan')"
  );
  if definition not like '%manager%' then
    raise exception 'Could not safely extend handle_new_user account type validation';
  end if;
  execute definition;

  select pg_get_functiondef('public.admin_update_profile(uuid,text,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text)'::regprocedure) into definition;
  definition := replace(
    definition,
    '(''player'',''coach'',''scout'',''agent'',''fan'')',
    "('player','coach','manager','scout','agent','fan')"
  );
  if definition not like '%manager%' then
    raise exception 'Could not safely extend admin_update_profile account type validation';
  end if;
  execute definition;

  select pg_get_functiondef('public.enforce_private_nonplayer_profiles()'::regprocedure) into definition;
  definition := replace(
    definition,
    'new.account_type in (''scout'',''agent'',''fan'')',
    "new.account_type in ('manager','scout','agent','fan')"
  );
  if definition not like '%manager%' then
    raise exception 'Could not safely extend non-player profile privacy rules';
  end if;
  execute definition;
end $$;

drop policy if exists "users can submit profile claims" on public.profile_claim_requests;
create policy "coaches and managers can submit profile claims"
  on public.profile_claim_requests
  for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type in ('coach', 'manager')
    )
  );
