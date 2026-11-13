-- SECURITY-FINAL: read-only privilege assertions for membership RPC
-- Run only in a read-only session. Do not call admin_set_membership here.
SELECT column_name,data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='admin_roles'
ORDER BY ordinal_position;

SELECT p.proname,p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
 pg_get_functiondef(p.oid) LIKE '%is_current_user_admin_or_moderator%' AS permits_moderator_check,
 pg_get_functiondef(p.oid) LIKE '%stripe_subscription_id%' AS stripe_guard_present
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='admin_set_membership';

SELECT policyname,cmd,roles,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename='admin_roles'
ORDER BY policyname;
