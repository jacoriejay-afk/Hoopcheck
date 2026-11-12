-- Run against staging with isolated test identities, never production.
-- Verify the function is SECURITY DEFINER and anon/PUBLIC cannot invoke it.
select p.prosecdef,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       pg_get_functiondef(p.oid) like '%Only admins can manage memberships%' as admin_guard_present,
       pg_get_functiondef(p.oid) like '%stripe_subscription_id%' as stripe_guard_present
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='admin_set_membership';

-- With authenticated role and JWT subject set to a dedicated moderator fixture:
-- select public.admin_set_membership('<fixture-user-uuid>'::uuid,'premium');
-- EXPECT SQLSTATE 42501, zero subscription changes.
-- Repeat for a regular user: EXPECT SQLSTATE 42501.
-- With a dedicated admin fixture and non-Stripe test user:
-- EXPECT true; rollback the transaction.
-- With an admin and Stripe-linked fixture: EXPECT exception, unchanged subscription.
