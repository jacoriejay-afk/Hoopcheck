-- Prevent direct Data API clients from bookmarking inaccessible posts. Posts are permanent.
-- Preserve own-bookmark SELECT and DELETE policies so existing saves can be removed.
begin;
drop policy if exists "feed bookmarks insert own" on public.feed_post_bookmarks;
create policy "feed bookmarks insert own" on public.feed_post_bookmarks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.feed_posts fp
      where fp.id = feed_post_bookmarks.post_id
        and fp.status = 'approved'
        )
  );
commit;
