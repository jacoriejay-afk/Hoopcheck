-- Extend the dedicated fan feed to support the separate women's directory table.
-- Existing men's posts remain attached to public.teams and retain their foreign key.

alter table public.fan_feed_posts
  alter column team_id drop not null;

alter table public.fan_feed_posts
  add column if not exists womens_team_id uuid
  references public.womens_teams(id) on delete cascade;

alter table public.fan_feed_posts
  drop constraint if exists fan_feed_posts_exactly_one_team_target;

alter table public.fan_feed_posts
  add constraint fan_feed_posts_exactly_one_team_target
  check (
    (team_id is not null and womens_team_id is null)
    or
    (team_id is null and womens_team_id is not null)
  );

create index if not exists fan_feed_posts_womens_team_created_idx
  on public.fan_feed_posts(womens_team_id, created_at desc)
  where womens_team_id is not null;

drop policy if exists "fan feed posts visible to fans" on public.fan_feed_posts;

create policy "fan feed posts visible to fans"
on public.fan_feed_posts
for select
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
