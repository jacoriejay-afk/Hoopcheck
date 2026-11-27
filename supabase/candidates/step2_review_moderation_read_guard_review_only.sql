-- REVIEW ONLY. Never apply to a hosted project without full schema/role acceptance.
-- The permissive "reviews paid read guard" lacks a moderation-status test.
-- PostgreSQL ORs permissive policies; this restrictive policy intersects them.
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
