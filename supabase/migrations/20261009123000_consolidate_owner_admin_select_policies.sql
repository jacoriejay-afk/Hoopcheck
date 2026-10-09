-- Consolidate equivalent SELECT policies without changing who can read rows.
DROP POLICY IF EXISTS "Admins can view verification requests" ON public.player_verification_requests;
DROP POLICY IF EXISTS "Players can view own verification requests" ON public.player_verification_requests;
CREATE POLICY "Verification requests owner or admin read"
ON public.player_verification_requests
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.admin_roles ar
    WHERE ar.user_id = (SELECT auth.uid())
      AND trim(lower(ar.role)) IN ('admin', 'moderator')
  )
);

DROP POLICY IF EXISTS reports_admin_read ON public.review_reports;
DROP POLICY IF EXISTS reports_own_read ON public.review_reports;
CREATE POLICY reports_owner_or_admin_read
ON public.review_reports
FOR SELECT
TO authenticated
USING (
  reporter_id = (SELECT auth.uid())
  OR private.is_admin_or_moderator()
);
