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


-- Prevent direct Data API writes from voting on inaccessible, expired,
-- unapproved or non-poll posts, or selecting a nonexistent option.
-- The EXISTS subquery runs as the caller and is subject to feed_posts RLS.
drop policy if exists "feed poll votes insert own" on public.feed_poll_votes;
create policy "feed poll votes insert own"
  on public.feed_poll_votes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.feed_posts p
      where p.id = post_id
        and p.status = 'approved'
        and p.post_kind = 'poll'
        and p.expires_at > now()
        and option_index >= 0
        and option_index < case
          when jsonb_typeof(p.poll_options) = 'array' then jsonb_array_length(p.poll_options)
          else 0
        end
    )
  );

drop policy if exists "feed poll votes update own" on public.feed_poll_votes;
create policy "feed poll votes update own"
  on public.feed_poll_votes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.feed_posts p
      where p.id = post_id
        and p.status = 'approved'
        and p.post_kind = 'poll'
        and p.expires_at > now()
        and option_index >= 0
        and option_index < case
          when jsonb_typeof(p.poll_options) = 'array' then jsonb_array_length(p.poll_options)
          else 0
        end
    )
  );


-- Direct Data API bookmark writes must not bypass post visibility.
-- Deleting one's own old bookmark remains possible after a post expires.
drop policy if exists "feed bookmarks insert own" on public.feed_post_bookmarks;
create policy "feed bookmarks insert own"
  on public.feed_post_bookmarks for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.feed_posts p
      where p.id = post_id
        and p.status = 'approved'
        and p.expires_at > now()
    )
  );


-- A restrictive policy combines with existing permissive INSERT policies,
-- retaining their subscription and ownership checks while requiring an active
-- approved post for direct check/reaction inserts.
drop policy if exists "feed checks approved post guard" on public.feed_post_checks;
create policy "feed checks approved post guard"
  on public.feed_post_checks
  as restrictive
  for insert to authenticated
  with check (
    exists (
      select 1 from public.feed_posts p
      where p.id = post_id
        and p.status = 'approved'
        and p.expires_at > now()
    )
  );


-- The existing comment/check SELECT policies already require follower access
-- and a non-expired post. Add approval as a restrictive condition so rejected
-- or pending posts cannot expose their comments or reaction metadata.
drop policy if exists "feed comments approved post guard" on public.feed_post_comments;
create policy "feed comments approved post guard"
  on public.feed_post_comments
  as restrictive
  for select to authenticated
  using (
    exists (
      select 1 from public.feed_posts p
      where p.id = post_id
        and p.status = 'approved'
        and p.expires_at > now()
    )
  );

drop policy if exists "feed checks read approved post guard" on public.feed_post_checks;
create policy "feed checks read approved post guard"
  on public.feed_post_checks
  as restrictive
  for select to authenticated
  using (
    exists (
      select 1 from public.feed_posts p
      where p.id = post_id
        and p.status = 'approved'
        and p.expires_at > now()
    )
  );

commit;

notify pgrst, 'reload schema';
