-- HoopCheck: allow admins/moderators to resolve author display names
-- in the moderation center without exposing profiles to ordinary users.

create policy "profiles_admin_read"
on public.profiles
for select
to authenticated
using (private.is_admin_or_moderator());
