create or replace function public.get_current_user_admin_role()
returns text
language sql
stable
security invoker
set search_path=public,pg_catalog
as $$
  select trim(lower(role))
  from public.admin_roles
  where user_id=(select auth.uid())
    and trim(lower(role)) in ('admin','moderator')
  order by case when trim(lower(role))='admin' then 0 else 1 end
  limit 1;
$$;

revoke all on function public.get_current_user_admin_role() from public, anon;
grant execute on function public.get_current_user_admin_role() to authenticated;