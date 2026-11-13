-- SECURITY-FINAL membership RPC isolated role integration tests.
-- DO NOT RUN AGAINST PRODUCTION. This script changes subscription rows.
-- Prerequisite: disposable local Supabase database, candidate function installed,
-- auth.users fixtures and admin_roles fixture rows created by test harness.
-- Replace the three fixture UUIDs with disposable test users before executing.
--
-- Recommended test actors:
--   admin:     11111111-1111-4111-8111-111111111111
--   moderator: 22222222-2222-4222-8222-222222222222
--   member:    33333333-3333-4333-8333-333333333333
--
-- Execute as a privileged test runner, using set_config('request.jwt.claim.sub', ..., true)
-- and SET LOCAL ROLE authenticated for each actor in isolated transactions.
-- ROLLBACK every test transaction; assert SQLSTATE 42501 for moderator/member.
-- Test Stripe-linked target with a nonempty stripe_subscription_id and assert
-- no change in subscription row. Test NULL and invalid plan -> SQLSTATE 22023.
--
-- This file deliberately contains no executable write statements until a
-- disposable fixture database and its setup/teardown are verified. Never
-- mistake this checklist for a passing integration test.
SELECT
  p.proname,
  p.prosecdef AS security_definer,
  p.proconfig AS function_settings,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anonymous_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'admin_set_membership';

-- Expected results matrix (run only in disposable fixture database):
-- actor        target type       plan       expected
-- admin        local/new         pro        success, active, +1 year
-- admin        local/existing    premium    success, active, +1 year
-- admin        local/existing    free       success, inactive/free
-- admin        Stripe-linked     free       exception; unchanged
-- admin        Stripe-linked     premium    exception; unchanged
-- admin        local             NULL       22023; unchanged
-- admin        local             'gold'     22023; unchanged
-- moderator    local             pro        42501; unchanged
-- member       local             pro        42501; unchanged
-- anonymous    local             pro        EXECUTE denied; unchanged
--
-- For each negative case, snapshot the target subscription before and after
-- and assert byte-for-byte equality of relevant fields. Verify a second
-- unrelated subscription remains unchanged for every successful case.
-- The admin role must come from public.admin_roles, never editable user_metadata.
-- Do not use a production service-role token as an authenticated test actor:
-- service_role bypasses RLS and cannot validate real end-user behavior.
