-- HoopCheck: use the least-privilege admin role check.
-- SECURITY INVOKER is sufficient because the caller can only read their own
-- admin_roles row through the existing RLS policy.

create or replace function public.is_current_user_admin_or_moderator()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.admin_roles
    where user_id = (select auth.uid())
      and trim(lower(role)) in ('admin', 'moderator')
  );
$$;

revoke all on function public.is_current_user_admin_or_moderator() from public, anon;
grant execute on function public.is_current_user_admin_or_moderator() to authenticated;
