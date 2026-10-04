-- Enforce review visibility and moderation permissions at the database layer.
CREATE OR REPLACE FUNCTION public.is_current_user_admin_or_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles
    WHERE user_id = (SELECT auth.uid())
      AND lower(btrim(role)) IN ('admin', 'moderator')
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin_or_moderator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin_or_moderator()
  TO anon, authenticated;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_roles_select_own_or_moderator
  ON public.admin_roles
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_current_user_admin_or_moderator())
  );

CREATE POLICY admin_roles_select_own_or_moderator_allowed
  ON public.admin_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_current_user_admin_or_moderator())
  );

CREATE POLICY admin_roles_block_client_inserts
  ON public.admin_roles
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY admin_roles_block_client_updates
  ON public.admin_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY admin_roles_block_client_deletes
  ON public.admin_roles
  AS RESTRICTIVE
  FOR DELETE
  TO anon, authenticated
  USING (false);

CREATE POLICY reviews_select_visible_or_moderator
  ON public.reviews
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'approved'
    OR author_id = (SELECT auth.uid())
    OR (SELECT public.is_current_user_admin_or_moderator())
  );

CREATE POLICY reviews_select_moderators
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_current_user_admin_or_moderator()));

CREATE POLICY reviews_insert_own_pending
  ON public.reviews
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND status = 'pending'
  );

CREATE POLICY reviews_insert_own_pending_allowed
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND status = 'pending'
  );

CREATE POLICY reviews_update_only_moderators
  ON public.reviews
  AS RESTRICTIVE
  FOR UPDATE
  TO anon, authenticated
  USING ((SELECT public.is_current_user_admin_or_moderator()))
  WITH CHECK (
    (SELECT public.is_current_user_admin_or_moderator())
    AND status IN ('approved', 'rejected', 'flagged', 'removed')
  );

CREATE POLICY review_reports_select_only_moderators
  ON public.review_reports
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING ((SELECT public.is_current_user_admin_or_moderator()));

CREATE POLICY review_reports_select_moderators
  ON public.review_reports
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_current_user_admin_or_moderator()));

CREATE POLICY review_reports_insert_own_pending
  ON public.review_reports
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    reporter_id = (SELECT auth.uid())
    AND status = 'pending'
    AND reason IN (
      'Spam or advertising',
      'Harassment or abusive content',
      'False or misleading information',
      'Personal information',
      'Threats or dangerous content',
      'Other'
    )
    AND EXISTS (
      SELECT 1
      FROM public.reviews AS reported_review
      WHERE reported_review.id = review_reports.review_id
        AND reported_review.status = 'approved'
    )
  );

CREATE POLICY review_reports_insert_own_pending_allowed
  ON public.review_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = (SELECT auth.uid())
    AND status = 'open'
    AND reason IN (
      'Spam or advertising',
      'Harassment or abusive content',
      'False or misleading information',
      'Personal information',
      'Threats or dangerous content',
      'Other'
    )
    AND EXISTS (
      SELECT 1
      FROM public.reviews AS reported_review
      WHERE reported_review.id = review_reports.review_id
        AND reported_review.status = 'approved'
    )
  );

CREATE POLICY review_reports_update_only_moderators
  ON public.review_reports
  AS RESTRICTIVE
  FOR UPDATE
  TO anon, authenticated
  USING ((SELECT public.is_current_user_admin_or_moderator()))
  WITH CHECK (
    (SELECT public.is_current_user_admin_or_moderator())
    AND status IN ('resolved', 'dismissed')
  );
