-- SECURITY-FEED-1: approved HoopFeed posts must be visible only to their
-- author, an explicitly followed author, or platform moderation.
-- Keep the existing unified entitlement and expiry checks.
-- This migration is intentionally NOT applied to production until the
-- authenticated role matrix and direct REST tests pass.
--
-- IMPORTANT: no block-relationship table currently exists in production;
-- block enforcement must be implemented and tested separately.
drop policy if exists "unified hoopfeed approved posts read" on public.feed_posts;
create policy "unified hoopfeed approved posts read"
on public.feed_posts for select to authenticated
using (
  (
    status = 'approved'
    and (expires_at is null or expires_at > now())
    and (select public.can_use_unified_hoopfeed())
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
