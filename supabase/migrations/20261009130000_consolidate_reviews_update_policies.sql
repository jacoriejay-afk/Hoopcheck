-- Consolidate admin/moderator and pending-author UPDATE rules without broadening access.
DROP POLICY IF EXISTS reviews_admin_update ON public.reviews;
DROP POLICY IF EXISTS reviews_authored_update ON public.reviews;
CREATE POLICY reviews_admin_or_pending_author_update
ON public.reviews
FOR UPDATE
TO authenticated
USING (
  private.is_admin_or_moderator()
  OR (
    author_id = (SELECT auth.uid())
    AND status = 'pending'
  )
)
WITH CHECK (
  private.is_admin_or_moderator()
  OR (
    author_id = (SELECT auth.uid())
    AND status = 'pending'
  )
);
