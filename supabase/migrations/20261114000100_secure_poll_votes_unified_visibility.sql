-- SECURITY-FINAL: align poll-vote access with the current unified HoopFeed visibility.
-- A poll must be approved, unexpired, valid, and visible through feed_posts RLS.
-- The feed_posts RLS policy applies the canonical block/follow/reshare checks.
-- No service-role bypass or subscription changes.
begin;
drop policy if exists "feed poll votes read" on public.feed_poll_votes;
drop policy if exists "feed poll votes insert own" on public.feed_poll_votes;
drop policy if exists "feed poll votes update own" on public.feed_poll_votes;

create policy "feed poll votes read" on public.feed_poll_votes
for select to authenticated using (
  exists (
    select 1 from public.feed_posts fp
    where fp.id = feed_poll_votes.post_id
      and fp.status = 'approved'
      and (fp.expires_at is null or fp.expires_at > now())
      and fp.post_kind = 'poll'
      and case when jsonb_typeof(fp.poll_options) = 'array'
        then feed_poll_votes.option_index >= 0
          and feed_poll_votes.option_index < jsonb_array_length(fp.poll_options)
        else false end
  )
);

create policy "feed poll votes insert own" on public.feed_poll_votes
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.feed_posts fp
    where fp.id = feed_poll_votes.post_id
      and fp.status = 'approved'
      and (fp.expires_at is null or fp.expires_at > now())
      and fp.post_kind = 'poll'
      and case when jsonb_typeof(fp.poll_options) = 'array'
        then feed_poll_votes.option_index >= 0
          and feed_poll_votes.option_index < jsonb_array_length(fp.poll_options)
        else false end
  )
);

create policy "feed poll votes update own" on public.feed_poll_votes
for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.feed_posts fp
    where fp.id = feed_poll_votes.post_id
      and fp.status = 'approved'
      and (fp.expires_at is null or fp.expires_at > now())
      and fp.post_kind = 'poll'
      and case when jsonb_typeof(fp.poll_options) = 'array'
        then feed_poll_votes.option_index >= 0
          and feed_poll_votes.option_index < jsonb_array_length(fp.poll_options)
        else false end
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.feed_posts fp
    where fp.id = feed_poll_votes.post_id
      and fp.status = 'approved'
      and (fp.expires_at is null or fp.expires_at > now())
      and fp.post_kind = 'poll'
      and case when jsonb_typeof(fp.poll_options) = 'array'
        then feed_poll_votes.option_index >= 0
          and feed_poll_votes.option_index < jsonb_array_length(fp.poll_options)
        else false end
  )
);
commit;
