-- Allow authenticated administrators/moderators to manage the global basketball directory.
-- Public/anonymous users retain read-only access through existing public_read policies.

create policy "coaches_admin_insert" on public.coaches for insert to authenticated
with check (public.is_current_user_admin_or_moderator());

create policy "coaches_admin_update" on public.coaches for update to authenticated
using (public.is_current_user_admin_or_moderator())
with check (public.is_current_user_admin_or_moderator());

create policy "coaches_admin_delete" on public.coaches for delete to authenticated
using (public.is_current_user_admin_or_moderator());

create policy "teams_admin_insert" on public.teams for insert to authenticated
with check (public.is_current_user_admin_or_moderator());

create policy "teams_admin_update" on public.teams for update to authenticated
using (public.is_current_user_admin_or_moderator())
with check (public.is_current_user_admin_or_moderator());

create policy "teams_admin_delete" on public.teams for delete to authenticated
using (public.is_current_user_admin_or_moderator());

create policy "leagues_admin_insert" on public.leagues for insert to authenticated
with check (public.is_current_user_admin_or_moderator());

create policy "leagues_admin_update" on public.leagues for update to authenticated
using (public.is_current_user_admin_or_moderator())
with check (public.is_current_user_admin_or_moderator());

create policy "leagues_admin_delete" on public.leagues for delete to authenticated
using (public.is_current_user_admin_or_moderator());
