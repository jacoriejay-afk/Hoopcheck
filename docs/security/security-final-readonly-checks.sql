-- SECURITY-FINAL read-only production policy assertions
-- Run with a read-only database connection. No DDL or data mutation.
-- Results are audit evidence, NOT a substitute for authenticated REST tests.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
('feed_posts','feed_poll_votes','feed_post_bookmarks','feed_post_checks','feed_post_comments')
ORDER BY c.relname;

SELECT tablename, policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN
('feed_posts','feed_poll_votes','feed_post_bookmarks','feed_post_checks','feed_post_comments')
ORDER BY tablename,cmd,policyname;

SELECT p.proname, p.prosecdef AS security_definer,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('admin_set_membership','admin_set_user_role','can_view_player_feed_post','can_use_unified_hoopfeed');

SELECT id, public FROM storage.buckets
WHERE id IN ('feed-images','feed-videos','hoopfeed-private-images','hoopfeed-private-videos')
ORDER BY id;

SELECT bucket_id, count(*) AS object_count FROM storage.objects
WHERE bucket_id IN ('feed-images','feed-videos','hoopfeed-private-images','hoopfeed-private-videos')
GROUP BY bucket_id ORDER BY bucket_id;
