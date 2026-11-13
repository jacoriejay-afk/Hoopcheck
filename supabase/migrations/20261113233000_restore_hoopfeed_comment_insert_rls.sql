-- Restore comment creation without bypassing HoopFeed visibility, blocks or tier checks.
-- The feed_posts SELECT RLS policy is evaluated in this EXISTS subquery.
DROP POLICY IF EXISTS "unified hoopfeed comments insert" ON public.feed_post_comments;
CREATE POLICY "unified hoopfeed comments insert"
ON public.feed_post_comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = (SELECT auth.uid())
  AND length(btrim(body)) BETWEEN 1 AND 2000
  AND EXISTS (
    SELECT 1 FROM public.feed_posts fp
    WHERE fp.id = feed_post_comments.post_id
      AND fp.status = 'approved'
      AND (fp.expires_at IS NULL OR fp.expires_at > now())
  )
);
