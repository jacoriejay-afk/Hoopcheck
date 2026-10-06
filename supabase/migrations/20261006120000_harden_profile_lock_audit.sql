alter table public.display_name_changes enable row level security;
drop policy if exists "display name changes own read" on public.display_name_changes;
create policy "display name changes own read"
on public.display_name_changes
for select to authenticated
using ((select auth.uid()) = user_id or public.is_current_user_admin_or_moderator());
revoke execute on function public.enforce_player_profile_locks() from anon, authenticated;
