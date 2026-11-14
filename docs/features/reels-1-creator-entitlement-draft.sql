-- REELS-1 creator entitlement alignment — REVIEW ONLY.
-- Derived from inspected production function definition on 2026-11-14.
-- Apply only after verifying account_type is server-controlled and running JWT tests.
-- This only aligns creator membership; it does NOT enable Reels or broaden follower visibility.
create or replace function public.can_use_unified_hoopfeed()
returns boolean
language sql stable
set search_path to ''
as $function$
  select exists (
    select 1
    from public.profiles viewer
    where viewer.id = (select auth.uid())
      and (
        viewer.account_type = 'admin'
        or (select public.get_current_user_admin_role()) = 'admin'
        or (
          viewer.account_type in ('player','fan','coach','scout','agent','club_admin','manager','creator')
          and exists (
            select 1 from public.subscriptions s
            where s.user_id = viewer.id
              and s.plan in ('pro','premium')
              and s.status in ('active','trialing')
              and coalesce(s.access_status,'active') in ('active','trialing','pro','premium')
              and (s.current_period_end is null or s.current_period_end > now())
          )
        )
      )
  );
$function$;

-- Separate required work:
-- 1. Confirm creator account_type cannot be self-assigned without verification.
-- 2. Extend follower relationship modeling for creators; existing
--    private.hoopfeed_can_read_author checks follow.target_type in ('player','fan').
-- 3. Verify no unexpected access to reviews, trust scores, or admin operations.
-- 4. Run real JWT test cases (Free, Pro, expired, creator, follower, blocked).
