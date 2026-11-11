-- Unified HoopFeed: retain follower-only visibility while allowing paid account roles.
-- Review and test on staging before applying to production.
-- This migration deliberately does not introduce SECURITY DEFINER or public access.
create or replace function public.can_view_player_feed_post(p_author_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select
    p_author_id = (select auth.uid())
    or public.is_current_user_admin_or_moderator()
    or exists (
      select 1
      from public.profiles viewer
      join public.subscriptions sub on sub.user_id = viewer.id
      join public.follow_relationships fr on fr.follower_id = viewer.id
        and fr.target_id = p_author_id
        and fr.target_type = 'player'
      join public.profiles author on author.id = p_author_id
      where viewer.id = (select auth.uid())
        and viewer.account_type in ('player','fan','coach','agent','scout','club_admin')
        and author.account_type = 'player'
        and sub.plan in ('pro','premium')
        and sub.status in ('active','trialing')
        and coalesce(sub.access_status,'active') in ('active','trialing','pro','premium')
        and (sub.current_period_end is null or sub.current_period_end > now())
        and (
          viewer.account_type <> 'player'
          or (
            viewer.current_country is not null
            and author.current_country is not null
            and lower(viewer.current_country) = lower(author.current_country)
          )
        )
    );
$$;

drop policy if exists "player feed checks insert" on public.feed_post_checks;
create policy "unified feed checks insert" on public.feed_post_checks
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.feed_posts fp
    join public.profiles viewer on viewer.id = (select auth.uid())
    join public.subscriptions sub on sub.user_id = viewer.id
    where fp.id = post_id
      and fp.status = 'approved'
      and fp.expires_at > now()
      and viewer.account_type in ('player','fan','coach','agent','scout','club_admin')
      and sub.plan in ('pro','premium')
      and sub.status in ('active','trialing')
      and coalesce(sub.access_status,'active') in ('active','trialing','pro','premium')
      and (sub.current_period_end is null or sub.current_period_end > now())
      and public.can_view_player_feed_post(fp.author_id)
  )
);
