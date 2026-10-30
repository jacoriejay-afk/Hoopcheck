-- Team representatives can delete their own updates but must use the moderated server route for edits.
drop policy if exists "approved team claimants manage own official updates" on public.team_fanfeed_posts;
revoke update on table public.team_fanfeed_posts from anon, authenticated;
grant select, delete on table public.team_fanfeed_posts to authenticated;
grant all on table public.team_fanfeed_posts to service_role;
