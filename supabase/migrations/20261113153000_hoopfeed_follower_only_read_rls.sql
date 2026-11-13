-- SECURITY-FEED-1: approved HoopFeed posts must be visible only to their
-- author, an explicitly followed author, or platform moderation.
-- Keep the existing unified entitlement and expiry checks.
-- This migration is intentionally NOT applied to production until the
-- authenticated role matrix and direct REST tests pass.
--
-- Block relationships are created below and checked in both directions.
-- NOTE: approved posts remain hidden from blocked pairs even for moderators;
-- this is deliberate user-facing visibility, not a moderation audit endpoint.
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon;
grant select, insert, delete on public.user_blocks to authenticated;
drop policy if exists "user blocks own select" on public.user_blocks;
create policy "user blocks own select" on public.user_blocks
for select to authenticated
using (blocker_id = (select auth.uid()) or blocked_id = (select auth.uid()));
drop policy if exists "user blocks own insert" on public.user_blocks;
create policy "user blocks own insert" on public.user_blocks
for insert to authenticated
with check (blocker_id = (select auth.uid()));
drop policy if exists "user blocks own delete" on public.user_blocks;
create policy "user blocks own delete" on public.user_blocks
for delete to authenticated
using (blocker_id = (select auth.uid()));

drop policy if exists "unified hoopfeed approved posts read" on public.feed_posts;
create policy "unified hoopfeed approved posts read"
on public.feed_posts for select to authenticated
using (
  (
    status = 'approved'
    and (expires_at is null or expires_at > now())
    and (select public.can_use_unified_hoopfeed())
    and not exists (
      select 1 from public.user_blocks ub
      where (ub.blocker_id = (select auth.uid()) and ub.blocked_id = feed_posts.author_id)
         or (ub.blocker_id = feed_posts.author_id and ub.blocked_id = (select auth.uid()))
    )
    and (
      author_id = (select auth.uid())
      or (select public.is_current_user_admin_or_moderator())
      or exists (
        select 1
        from public.follow_relationships fr
        join public.profiles author_profile
          on author_profile.id = feed_posts.author_id
        where fr.follower_id = (select auth.uid())
          and fr.target_id = feed_posts.author_id
          and fr.target_type = author_profile.account_type
      )
    )
  )
  or (
    status <> 'approved'
    and (
      author_id = (select auth.uid())
      or (select public.is_current_user_admin_or_moderator())
    )
  )
);
