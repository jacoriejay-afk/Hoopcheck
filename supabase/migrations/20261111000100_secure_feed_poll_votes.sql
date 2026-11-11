-- Security hardening: align poll vote access with HoopFeed post visibility.
-- Review and rehearse on staging before production rollout.
begin;
drop policy if exists "feed poll votes read" on public.feed_poll_votes;
create policy "feed poll votes read" on public.feed_poll_votes
  for select to authenticated
  using (exists (
    select 1 from public.feed_posts fp
    where fp.id = feed_poll_votes.post_id
      and fp.expires_at > now()
      and public.can_view_player_feed_post(fp.author_id)
  ));
drop policy if exists "feed poll votes insert own" on public.feed_poll_votes;
create policy "feed poll votes insert own" on public.feed_poll_votes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.feed_posts fp
      where fp.id = feed_poll_votes.post_id
        and fp.expires_at > now()
        and public.can_view_player_feed_post(fp.author_id)
    )
  );
drop policy if exists "feed poll votes update own" on public.feed_poll_votes;
create policy "feed poll votes update own" on public.feed_poll_votes
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.feed_posts fp
      where fp.id = feed_poll_votes.post_id
        and fp.expires_at > now()
        and public.can_view_player_feed_post(fp.author_id)
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.feed_posts fp
      where fp.id = feed_poll_votes.post_id
        and fp.expires_at > now()
        and public.can_view_player_feed_post(fp.author_id)
    )
  );
-- Preserve existing own-vote DELETE policy for cleanup.
commit;
