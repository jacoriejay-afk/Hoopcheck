-- Apply billing-period expiry to direct reads and post-authorized media delivery.
alter policy "fan feed posts visible to fans"
on public.fan_feed_posts
to authenticated
using (
  status = 'approved'
  and expires_at > now()
  and exists (
    select 1
    from public.profiles viewer
    join public.subscriptions sub on sub.user_id = viewer.id
    where viewer.id = (select auth.uid())
      and viewer.account_type = 'fan'
      and sub.plan in ('pro', 'premium')
      and sub.status in ('active', 'trialing')
      and (sub.current_period_end is null or sub.current_period_end > now())
      and coalesce(sub.access_status, 'active') in ('active', 'trialing', 'pro', 'premium')
      and (
        author_id = viewer.id
        or exists (
          select 1 from public.follow_relationships fr
          where fr.follower_id = viewer.id
            and fr.target_type = 'fan'
            and fr.target_id = author_id
        )
        or exists (
          select 1 from public.follow_relationships tr
          where tr.follower_id = viewer.id
            and tr.target_type = 'team'
            and tr.target_id = coalesce(team_id, womens_team_id)
        )
      )
  )
);

alter policy "fans read followed official team updates"
  on public.team_fanfeed_posts to authenticated
  using (
    status = 'published'
    and (
      author_id = (select auth.uid())
      or public.is_current_user_admin_or_moderator()
      or exists (
        select 1
        from public.profiles viewer
        join public.subscriptions s on s.user_id = viewer.id
        join public.follow_relationships fr
          on fr.follower_id = viewer.id
         and fr.target_type = 'team'
         and fr.target_id = team_fanfeed_posts.team_id
        where viewer.id = (select auth.uid())
          and viewer.account_type = 'fan'
          and s.plan in ('pro','premium')
          and s.status in ('active','trialing')
          and (s.current_period_end is null or s.current_period_end > now())
          and coalesce(s.access_status,'active') in ('active','trialing','pro','premium')
      )
    )
  );
