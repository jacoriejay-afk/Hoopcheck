-- Read-only production preflight. Safe to run before deployment.
-- Expected: sponsor_inquiries RLS enabled; existing INSERT policy present.
select c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_catalog.pg_class c
where c.oid = 'public.sponsor_inquiries'::regclass;

select policyname, cmd, roles, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'sponsor_inquiries'
order by policyname;

select p.proname, p.prosecdef as security_definer,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_current_user_admin_role', 'limit_sponsor_inquiry_submissions');

select t.tgname, pg_catalog.pg_get_triggerdef(t.oid) as trigger_definition
from pg_catalog.pg_trigger t
where t.tgrelid = 'public.sponsor_inquiries'::regclass and not t.tgisinternal;

-- Post-deployment role tests must be run using genuine user sessions:
-- 1. admin: SELECT permitted; no broader write grants added.
-- 2. moderator: SELECT denied.
-- 3. ordinary member: SELECT denied; one INSERT permitted.
-- 4. signed out: SELECT and INSERT denied.
-- 5. same user immediate second INSERT: rejected by throttle.
-- 6. user 2's first INSERT: permitted despite user 1's throttle.
-- Never simulate authentication by setting a user-controlled JWT claim.
