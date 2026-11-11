-- Staged for review only. Do not apply until authenticated role tests are ready.
-- Unified HoopFeed: replace obsolete follower/country/player-only policies.
-- Keep paid access and owner/admin moderation visibility. Posts are permanent.
ALTER TABLE public.feed_posts ALTER COLUMN expires_at DROP DEFAULT;
DROP POLICY IF EXISTS "player experience feed read" ON public.feed_posts;
CREATE POLICY "unified hoopfeed approved posts read"
ON public.feed_posts FOR SELECT TO authenticated
USING (
  (status = 'approved' AND (
    EXISTS (
      SELECT 1 FROM public.profiles viewer
      JOIN public.subscriptions sub ON sub.user_id = viewer.id
      WHERE viewer.id = (SELECT auth.uid())
        AND viewer.account_type IN ('player','fan','coach','scout','agent','club_admin','admin')
        AND sub.plan IN ('pro','premium')
        AND sub.status IN ('active','trialing')
        AND coalesce(sub.access_status,'active') IN ('active','trialing','pro','premium')
        AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
    )
    OR public.is_current_user_admin_or_moderator()
  ))
  OR (author_id = (SELECT auth.uid()))
  OR public.is_current_user_admin_or_moderator()
);

DROP POLICY IF EXISTS "player feed checks read" ON public.feed_post_checks;
CREATE POLICY "unified hoopfeed checks read"
ON public.feed_post_checks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.feed_posts fp
    WHERE fp.id = feed_post_checks.post_id
      AND fp.status = 'approved'
  )
);

DROP POLICY IF EXISTS "player feed checks insert" ON public.feed_post_checks;
CREATE POLICY "unified hoopfeed checks insert"
ON public.feed_post_checks FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.feed_posts fp
    WHERE fp.id = feed_post_checks.post_id
      AND fp.status = 'approved'
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.subscriptions s ON s.user_id = p.id
      WHERE p.id = (SELECT auth.uid())
        AND p.account_type IN ('player','fan','coach','scout','agent','club_admin','admin')
        AND s.plan IN ('pro','premium')
        AND s.status IN ('active','trialing')
        AND coalesce(s.access_status,'active') IN ('active','trialing','pro','premium')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    )
    OR public.is_current_user_admin_or_moderator()
  )
);
