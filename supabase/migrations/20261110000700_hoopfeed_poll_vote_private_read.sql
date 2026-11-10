-- Security fix: raw poll votes must not be readable by every signed-in account.
-- Deploy with the viewer-authorized aggregate endpoint and updated HoopFeed UI.
-- This migration is committed for review only; it has NOT been run against production.
begin;

alter table public.feed_poll_votes enable row level security;

drop policy if exists "feed poll votes read" on public.feed_poll_votes;
create policy "feed poll votes read"
  on public.feed_poll_votes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

commit;

notify pgrst, 'reload schema';
