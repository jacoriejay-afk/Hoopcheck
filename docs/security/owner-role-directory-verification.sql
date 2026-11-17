-- SECURITY-FINAL #580 verification. READ ONLY. Run only after migration on staging.
-- Never run against production as a substitute for authenticated HTTP tests.
SELECT
  pg_get_functiondef('public.admin_list_user_roles(text)'::regprocedure)
    LIKE '%hoopcheck_security.is_approved_owner()%' AS has_owner_guard,
  pg_get_functiondef('public.admin_list_user_roles(text)'::regprocedure)
    LIKE '%Only approved owner admins%' AS has_denial_guard,
  has_function_privilege('anon','public.admin_list_user_roles(text)','EXECUTE') AS anonymous_can_execute,
  has_function_privilege('authenticated','public.admin_list_user_roles(text)','EXECUTE') AS authenticated_can_invoke;
-- The final value may be true because the function performs its own per-user guard.
-- Authenticated HTTP tests must verify: owner/admin allowed, moderator denied,
-- regular authenticated denied, club manager denied, anonymous denied.
-- Do not spoof request.jwt.claim.sub in production as a substitute for real sessions.
