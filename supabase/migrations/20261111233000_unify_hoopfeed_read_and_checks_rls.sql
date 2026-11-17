-- Match the application's unified HoopFeed membership gate. Inventory deployed
-- policies before rollout because additional permissive policies combine with OR.
BEGIN;

ALTER TABLE public.feed_posts ALTER COLUMN expires_at DROP DEFAULT;
ALTER TABLE public.feed_posts ALTER COLUMN expires_at DROP NOT NULL;

CREATE FUNCTION public.can_use_unified_hoopfeed()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles viewer
    WHERE viewer.id = (SELECT auth.uid())
      AND (
        viewer.account_type = 'admin'
        OR (SELECT public.get_current_user_admin_role()) = 'admin'
        OR (
          viewer.account_type IN ('player','fan','coach','scout','agent','club_admin','manager')
          AND EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.user_id = viewer.id
              AND s.plan IN ('pro','premium')
              AND s.status IN ('active','trialing')
              AND coalesce(s.access_status,'active') IN ('active','trialing','pro','premium')
              AND (s.current_period_end IS NULL OR s.current_period_end > now())
          )
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_use_unified_hoopfeed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_unified_hoopfeed() TO authenticated;

DROP POLICY IF EXISTS "player experience feed read" ON public.feed_posts;
CREATE POLICY "unified hoopfeed approved posts read"
ON public.feed_posts FOR SELECT TO authenticated
USING (
  (status = 'approved'
    AND (expires_at IS NULL OR expires_at > now())
    AND (SELECT public.can_use_unified_hoopfeed()))
  OR (status <> 'approved'
    AND (author_id = (SELECT auth.uid()) OR (SELECT public.is_current_user_admin_or_moderator())))
);

DROP POLICY IF EXISTS "player feed checks read" ON public.feed_post_checks;
CREATE POLICY "unified hoopfeed checks read"
ON public.feed_post_checks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.feed_posts fp
    WHERE fp.id = feed_post_checks.post_id AND fp.status = 'approved'
  )
);

DROP POLICY IF EXISTS "unified feed checks insert" ON public.feed_post_checks;
DROP POLICY IF EXISTS "player feed checks insert" ON public.feed_post_checks;
CREATE POLICY "unified hoopfeed checks insert"
ON public.feed_post_checks FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.feed_posts fp
    WHERE fp.id = feed_post_checks.post_id AND fp.status = 'approved'
  )
);

DROP POLICY IF EXISTS "player feed comments read" ON public.feed_post_comments;
CREATE POLICY "unified hoopfeed comments read"
ON public.feed_post_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.feed_posts fp
    WHERE fp.id = feed_post_comments.post_id AND fp.status = 'approved'
  )
);

COMMIT;
