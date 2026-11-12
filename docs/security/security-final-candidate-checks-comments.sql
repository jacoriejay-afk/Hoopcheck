-- SECURITY-FINAL candidate for checks/comments — REVIEW ONLY; NOT a migration.
-- Uses caller-visible feed_posts rows, including approved permanent posts.
-- Before promotion confirm the unified paid-tier rules, block rules and moderator
-- visibility; an EXISTS query is filtered by the invoking user's feed_posts RLS.
BEGIN;
DROP POLICY IF EXISTS "unified hoopfeed checks read" ON public.feed_post_checks;
CREATE POLICY "unified hoopfeed checks read" ON public.feed_post_checks
 FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.feed_posts fp
 WHERE fp.id=feed_post_checks.post_id AND fp.status='approved'
 AND (fp.expires_at IS NULL OR fp.expires_at>now())));
DROP POLICY IF EXISTS "unified hoopfeed checks insert" ON public.feed_post_checks;
DROP POLICY IF EXISTS "unified feed checks insert" ON public.feed_post_checks;
CREATE POLICY "unified hoopfeed checks insert" ON public.feed_post_checks
 FOR INSERT TO authenticated WITH CHECK (
 user_id=(SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM public.feed_posts fp
 WHERE fp.id=feed_post_checks.post_id AND fp.status='approved'
 AND (fp.expires_at IS NULL OR fp.expires_at>now())));
DROP POLICY IF EXISTS "unified hoopfeed comments read" ON public.feed_post_comments;
CREATE POLICY "unified hoopfeed comments read" ON public.feed_post_comments
 FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.feed_posts fp
 WHERE fp.id=feed_post_comments.post_id AND fp.status='approved'
 AND (fp.expires_at IS NULL OR fp.expires_at>now())));
-- Intentionally no INSERT policy yet: production shows no comments INSERT
-- policy in pg_policies. The application may use a server-side write endpoint.
-- Audit that endpoint and its moderation/role checks before introducing direct
-- Data API INSERT. Do not unintentionally bypass moderation.
COMMIT;
