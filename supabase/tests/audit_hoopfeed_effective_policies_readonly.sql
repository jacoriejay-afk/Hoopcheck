-- READ-ONLY inventory for SECURITY-BATCH-1. Run with a privileged
-- database reader in a disposable/staging environment before migration.
-- Do not treat this inventory as proof that runtime authorization passes.
-- PostgreSQL permissive policies combine with OR; a second permissive
-- policy may grant access even when a new one looks restrictive.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'feed_posts', 'feed_post_checks', 'feed_post_comments',
    'feed_poll_votes', 'feed_post_bookmarks'
  )
ORDER BY tablename, cmd, policyname;

-- Confirm that RLS is enabled and whether FORCE RLS is configured.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'feed_posts', 'feed_post_checks', 'feed_post_comments',
    'feed_poll_votes', 'feed_post_bookmarks'
  )
  AND c.relkind IN ('r','p')
ORDER BY c.relname;

-- Table privileges: an RLS policy cannot compensate for unexpected
-- grants, privileged service-role bypass, or a SECURITY DEFINER function.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'feed_posts', 'feed_post_checks', 'feed_post_comments',
    'feed_poll_votes', 'feed_post_bookmarks'
  )
ORDER BY table_name, grantee, privilege_type;
