-- Restrict poll-vote reads to authorized, unexpired feed posts.
-- Direct database inspection 2026-11-11 confirmed:
-- * feed_poll_votes has RLS enabled and FK post_id -> feed_posts(id)
-- * the previous authenticated SELECT policy used USING (true)
-- * anon and authenticated had broad table grants, including TRUNCATE
-- WARNING: TRUNCATE is not protected by row-level security.
begin;

-- Anonymous users have no legitimate direct access to private HoopFeed votes.
revoke all privileges on table public.feed_poll_votes from anon;

-- RLS does not govern TRUNCATE; untrusted clients must never have it.
-- REFERENCES/TRIGGER are schema-level capabilities, not normal vote actions.
revoke truncate, trigger, references on table public.feed_poll_votes from authenticated;

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
