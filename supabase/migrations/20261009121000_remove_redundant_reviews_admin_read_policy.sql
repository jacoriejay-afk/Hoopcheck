-- Remove a redundant permissive SELECT policy on reviews.
-- reviews_subscriber_read already permits moderators/admins, and the restrictive
-- reviews paid read guard continues to enforce the paid/member access boundary.
DROP POLICY IF EXISTS reviews_admin_read ON public.reviews;
