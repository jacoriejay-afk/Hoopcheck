-- REVIEW ONLY. Never apply to a hosted project without full schema/role acceptance.
-- Exported PG17 baseline uses a restrictive paid guard intersecting a
-- permissive subscriber/owner/moderator policy. This additional guard is
-- defense in depth against alternate permissive configurations, not proof
-- of a baseline nonapproved-row leak. It does not mask author_id.
-- Retains own-review and existing moderator visibility without granting new access.
BEGIN;
CREATE POLICY step2_review_moderation_read_guard ON public.reviews
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      status = 'approved'
      OR author_id = (SELECT auth.uid())
      OR (SELECT private.is_admin_or_moderator())
    )
  );
COMMIT;
