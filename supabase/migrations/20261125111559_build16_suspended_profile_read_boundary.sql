-- Align direct public reads with the directory's suspended-profile exclusion.
-- Preserve self access and staff moderation access; do not change UPDATE policy.
alter policy profiles_public_read on public.profiles
 using (profile_visibility='public' and moderation_status is distinct from 'suspended');
alter policy profiles_authenticated_read on public.profiles
 using ((profile_visibility='public' and moderation_status is distinct from 'suspended')
 or id=(select auth.uid()) or (select private.is_admin_or_moderator()));
