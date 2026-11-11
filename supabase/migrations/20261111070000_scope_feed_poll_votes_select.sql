-- SECURITY: restrict poll-vote reads to posts the caller can actually view.
-- This migration intentionally does not change production until reviewed and deployed.
-- Existing feed_posts SELECT RLS enforces expiry and can_view_player_feed_post.
begin;
drop policy if exists "feed poll votes read" on public.feed_poll_votes;
create policy "feed poll votes read"
on public.feed_poll_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.feed_posts p
    where p.id = feed_poll_votes.post_id
      and p.expires_at > now()
      and public.can_view_player_feed_post(p.author_id)
  )
);
commit;
