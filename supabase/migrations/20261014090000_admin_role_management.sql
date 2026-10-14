-- Allow existing admins to manage admin/moderator assignments from the admin user console.
-- Authorization is enforced inside these SECURITY DEFINER functions; the browser never writes admin_roles directly.

create or replace function public.admin_list_user_roles(p_query text default null)
returns table (
  id uuid,
  email text,
  display_name text,
  username text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  if not exists (
    select 1
    from public.admin_roles ar
    where ar.user_id = (select auth.uid())
      and lower(trim(coalesce(ar.role, ''))) = 'admin'
  ) then
    raise exception 'Only admins can manage role assignments'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.display_name,
    p.username,
    (
      select lower(trim(ar.role))
      from public.admin_roles ar
      where ar.user_id = p.id
        and lower(trim(coalesce(ar.role, ''))) in ('admin', 'moderator')
      order by case when lower(trim(ar.role)) = 'admin' then 0 else 1 end
      limit 1
    ) as role,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p_query is null
     or trim(p_query) = ''
     or lower(coalesce(u.email, '')) like '%' || lower(trim(p_query)) || '%'
     or lower(coalesce(p.username, '')) like '%' || lower(trim(p_query)) || '%'
     or lower(coalesce(p.display_name, '')) like '%' || lower(trim(p_query)) || '%'
  order by p.created_at desc
  limit 500;
end;
$function$;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_role text := nullif(lower(trim(coalesce(p_role, ''))), '');
  v_existing_role text;
  v_admin_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.admin_roles ar
    where ar.user_id = (select auth.uid())
      and lower(trim(coalesce(ar.role, ''))) = 'admin'
  ) then
    raise exception 'Only admins can manage role assignments'
      using errcode = '42501';
  end if;

  if v_role not in ('admin', 'moderator') and v_role is not null then
    raise exception 'Role must be admin, moderator, or empty to remove access'
      using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  select lower(trim(ar.role))
    into v_existing_role
  from public.admin_roles ar
  where ar.user_id = p_user_id
    and lower(trim(coalesce(ar.role, ''))) in ('admin', 'moderator')
  order by case when lower(trim(ar.role)) = 'admin' then 0 else 1 end
  limit 1;

  if v_existing_role = 'admin' and v_role is distinct from 'admin' then
    select count(*)::integer into v_admin_count
    from public.admin_roles ar
    where lower(trim(coalesce(ar.role, ''))) = 'admin';

    if v_admin_count <= 1 then
      raise exception 'The last admin cannot be demoted or removed'
        using errcode = '23514';
    end if;
  end if;

  if v_role is null then
    delete from public.admin_roles where user_id = p_user_id;
    return 'Role access removed';
  end if;

  insert into public.admin_roles (user_id, role)
  values (p_user_id, v_role)
  on conflict (user_id)
  do update set role = excluded.role;

  return 'Role updated to ' || v_role;
end;
$function$;

revoke all on function public.admin_list_user_roles(text) from public, anon;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_list_user_roles(text) to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
