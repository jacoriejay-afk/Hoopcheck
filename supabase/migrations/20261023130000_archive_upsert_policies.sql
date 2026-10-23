-- Allow idempotent archive buttons to upsert the user's own archive row.
drop policy if exists "authors update own HoopFeed archives" on public.feed_post_archives;
create policy "authors update own HoopFeed archives" on public.feed_post_archives
  for update to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));

drop policy if exists "authors update own fan archives" on public.fan_feed_archives;
create policy "authors update own fan archives" on public.fan_feed_archives
  for update to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));

grant update on public.feed_post_archives, public.fan_feed_archives to authenticated;
