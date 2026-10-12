-- Move the 17 advisor-flagged SECURITY DEFINER functions out of the exposed
-- public schema while preserving their public RPC signatures as SECURITY INVOKER
-- wrappers. The private schema is not part of PostgREST's exposed schemas.
-- Privileged logic remains in the original functions and keeps its internal
-- authorization checks. This avoids breaking existing client RPC call sites.

begin;
set local search_path = public, pg_catalog;

-- Ensure the unexposed implementation schema exists on fresh installations.
create schema if not exists private;

-- Authenticated clients need schema usage to reach private implementations
-- through the SECURITY INVOKER wrappers; service-role jobs may call them too.
grant usage on schema private to authenticated, service_role;

-- Some existing installations already have an older private copy of this exact
-- function signature. The public implementation is newer (it also updates the
-- selected team/affiliation fields), so remove that stale copy before moving
-- the current public implementation into private. DROP uses RESTRICT by default:
-- if another database object depends on the old function, abort safely.
drop function if exists private.moderate_player_verification(uuid, text, text);

do $migration$
declare
  r record;
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname = any (array[
        'admin_delete_directory_entry',
        'admin_list_users',
        'admin_moderate_profile',
        'admin_moderate_review_comment',
        'admin_resolve_profile_report',
        'admin_review_coach_team_request',
        'admin_review_directory_team_request',
        'admin_set_membership',
        'admin_update_profile',
        'admin_update_support_ticket',
        'can_user_follow_target',
        'can_user_review_team',
        'get_follow_count',
        'get_hoopcheck_kpis',
        'get_review_like_count',
        'get_womens_review_rating_summary',
        'moderate_player_verification'
      ])
  loop
    execute format(
      'alter function public.%I(%s) set schema private',
      r.proname,
      r.identity_args
    );
  end loop;
end
$migration$;

-- Private functions are callable by the authenticated wrappers but are not
-- exposed as direct PostgREST RPC endpoints. Do not allow anonymous/public use.
do $permissions$
declare
  r record;
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.prosecdef
      and p.proname = any (array[
        'admin_delete_directory_entry',
        'admin_list_users',
        'admin_moderate_profile',
        'admin_moderate_review_comment',
        'admin_resolve_profile_report',
        'admin_review_coach_team_request',
        'admin_review_directory_team_request',
        'admin_set_membership',
        'admin_update_profile',
        'admin_update_support_ticket',
        'can_user_follow_target',
        'can_user_review_team',
        'get_follow_count',
        'get_hoopcheck_kpis',
        'get_review_like_count',
        'get_womens_review_rating_summary',
        'moderate_player_verification'
      ])
  loop
    execute format(
      'revoke execute on function private.%I(%s) from public, anon',
      r.proname,
      r.identity_args
    );
    execute format(
      'grant execute on function private.%I(%s) to authenticated, service_role',
      r.proname,
      r.identity_args
    );

    -- SECURITY DEFINER implementations must not inherit a caller-controlled
    -- or mutable search path. All application objects referenced by these
    -- implementations are schema-qualified, so an empty path is safe.
    execute format(
      'alter function private.%I(%s) set search_path = ''''',
      r.proname,
      r.identity_args
    );
  end loop;
end
$permissions$;

-- Recreate same-name/same-signature public wrappers. SECURITY INVOKER ensures
-- the exposed endpoint itself is not SECURITY DEFINER; the nested private
-- function performs the privileged work and retains its own authorization.
do $wrappers$
declare
  r record;
  v_call_args text;
  v_body text;
  v_volatility text;
begin
  for r in
    select p.oid, p.proname,
           pg_get_function_arguments(p.oid) as full_args,
           pg_get_function_identity_arguments(p.oid) as identity_args,
           pg_get_function_result(p.oid) as result_type,
           p.pronargs,
           p.proretset,
           p.provolatile
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.prosecdef
      and p.proname = any (array[
        'admin_delete_directory_entry',
        'admin_list_users',
        'admin_moderate_profile',
        'admin_moderate_review_comment',
        'admin_resolve_profile_report',
        'admin_review_coach_team_request',
        'admin_review_directory_team_request',
        'admin_set_membership',
        'admin_update_profile',
        'admin_update_support_ticket',
        'can_user_follow_target',
        'can_user_review_team',
        'get_follow_count',
        'get_hoopcheck_kpis',
        'get_review_like_count',
        'get_womens_review_rating_summary',
        'moderate_player_verification'
      ])
    order by p.proname
  loop
    select coalesce(string_agg('$' || g.i::text, ', ' order by g.i), '')
      into v_call_args
    from generate_series(1, r.pronargs) as g(i);

    if r.proretset then
      v_body := format('select * from private.%I(%s)', r.proname, v_call_args);
    else
      v_body := format('select private.%I(%s)', r.proname, v_call_args);
    end if;

    v_volatility := case r.provolatile
      when 'i' then 'immutable'
      when 's' then 'stable'
      else 'volatile'
    end;

    execute format(
      'create function public.%I(%s) returns %s language sql %s security invoker set search_path = '''' as %L',
      r.proname,
      r.full_args,
      r.result_type,
      v_volatility,
      v_body
    );

    execute format(
      'revoke execute on function public.%I(%s) from public, anon',
      r.proname,
      r.identity_args
    );

    execute format(
      'grant execute on function public.%I(%s) to authenticated, service_role',
      r.proname,
      r.identity_args
    );
  end loop;
end
$wrappers$;

-- Fail the migration if any of the 17 exposed wrappers is still SECURITY DEFINER
-- or if any original privileged implementation was not moved to private.
do $verify$
declare
  v_remaining integer;
  v_missing integer;
begin
  select count(*) into v_remaining
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.proname = any (array[
      'admin_delete_directory_entry',
      'admin_list_users',
      'admin_moderate_profile',
      'admin_moderate_review_comment',
      'admin_resolve_profile_report',
      'admin_review_coach_team_request',
      'admin_review_directory_team_request',
      'admin_set_membership',
      'admin_update_profile',
      'admin_update_support_ticket',
      'can_user_follow_target',
      'can_user_review_team',
      'get_follow_count',
      'get_hoopcheck_kpis',
      'get_review_like_count',
      'get_womens_review_rating_summary',
      'moderate_player_verification'
    ]);

  select count(*) into v_missing
  from unnest(array[
    'admin_delete_directory_entry',
    'admin_list_users',
    'admin_moderate_profile',
    'admin_moderate_review_comment',
    'admin_resolve_profile_report',
    'admin_review_coach_team_request',
    'admin_review_directory_team_request',
    'admin_set_membership',
    'admin_update_profile',
    'admin_update_support_ticket',
    'can_user_follow_target',
    'can_user_review_team',
    'get_follow_count',
    'get_hoopcheck_kpis',
    'get_review_like_count',
    'get_womens_review_rating_summary',
    'moderate_player_verification'
  ]) as expected(name)
  where not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = expected.name
      and p.prosecdef
  );

  if v_remaining <> 0 or v_missing <> 0 then
    raise exception 'SECURITY DEFINER RPC migration verification failed: remaining public definer functions %, missing private implementations %',
      v_remaining, v_missing;
  end if;
end
$verify$;

commit;
