-- Optimize repeated auth.uid() calls in request and identity-verification RLS policies.
-- Authorization predicates are unchanged; scalar subqueries let Postgres evaluate auth.uid() once per statement.

drop policy if exists "coach team requests eligible insert" on public.coach_team_requests;
create policy "coach team requests eligible insert"
on public.coach_team_requests
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    where p.id = (select auth.uid())
      and p.account_type = 'coach'
      and s.plan = any (array['pro'::text, 'premium'::text])
      and s.status = any (array['active'::text, 'trialing'::text])
      and (s.current_period_end is null or s.current_period_end > now())
  )
);

drop policy if exists "coach team requests own cancel" on public.coach_team_requests;
create policy "coach team requests own cancel"
on public.coach_team_requests
for update to authenticated
using ((user_id = (select auth.uid())) or public.is_current_user_admin_or_moderator())
with check ((user_id = (select auth.uid())) or public.is_current_user_admin_or_moderator());

drop policy if exists "coach team requests own read" on public.coach_team_requests;
create policy "coach team requests own read"
on public.coach_team_requests
for select to authenticated
using ((user_id = (select auth.uid())) or public.is_current_user_admin_or_moderator());

drop policy if exists "directory_team_requests_insert" on public.directory_team_requests;
create policy "directory_team_requests_insert"
on public.directory_team_requests
for insert to authenticated
with check (requester_id = (select auth.uid()));

drop policy if exists "directory_team_requests_select" on public.directory_team_requests;
create policy "directory_team_requests_select"
on public.directory_team_requests
for select to authenticated
using ((requester_id = (select auth.uid())) or public.is_current_user_admin_or_moderator());

drop policy if exists "identity verification own insert" on public.identity_verification_sessions;
create policy "identity verification own insert"
on public.identity_verification_sessions
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "identity verification own read" on public.identity_verification_sessions;
create policy "identity verification own read"
on public.identity_verification_sessions
for select to authenticated
using ((user_id = (select auth.uid())) or public.is_current_user_admin_or_moderator());
