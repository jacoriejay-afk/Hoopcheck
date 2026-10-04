-- Reconcile review moderation RLS with the production security model.
--
-- The production policies below are already represented by the earlier
-- migrations. This migration keeps RLS enabled and aligns the public
-- admin/moderator RPC with the production authorization model without
-- introducing duplicate restrictive policies.

create or replace function public.is_current_user_admin_or_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.admin_roles
    where user_id = (select auth.uid())
      and trim(lower(role)) in ('admin', 'moderator')
  );
$$;

revoke all on function public.is_current_user_admin_or_moderator() from public;
revoke execute on function public.is_current_user_admin_or_moderator() from anon;
grant execute on function public.is_current_user_admin_or_moderator()
  to authenticated;

alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;
alter table public.admin_roles enable row level security;

-- Keep the existing production policy set intact:
-- reviews_admin_read
-- reviews_admin_update
-- reviews_authored_insert
-- reviews_authored_update
-- reviews_subscriber_read
-- reports_admin_read
-- reports_admin_update
-- reports_own_insert
-- reports_own_read
