-- Keep public profiles visible to signed-out visitors while consolidating
-- authenticated public/owner/admin SELECT paths into a single policy.
DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_public_read"
ON public.profiles
FOR SELECT
TO anon
USING (profile_visibility = 'public');

CREATE POLICY "profiles_authenticated_read"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  profile_visibility = 'public'
  OR id = (SELECT auth.uid())
  OR private.is_admin_or_moderator()
);
