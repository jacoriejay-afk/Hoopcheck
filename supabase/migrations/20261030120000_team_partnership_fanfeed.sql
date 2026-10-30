-- Official team FanFeed publishing for approved team profile claimants.
-- Independent fan posts and player reviews remain separate and immutable to teams.

create table if not exists public.team_fanfeed_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  image_url text,
  status text not null default 'published' check (status in ('published','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_fanfeed_posts_team_created_idx
  on public.team_fanfeed_posts(team_id, created_at desc)
  where status = 'published';

alter table public.team_fanfeed_posts enable row level security;

drop policy if exists "fans read followed official team updates" on public.team_fanfeed_posts;
create policy "fans read followed official team updates"
  on public.team_fanfeed_posts for select to authenticated
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
          and coalesce(s.access_status,'active') in ('active','trialing','pro','premium')
      )
    )
  );

drop policy if exists "approved team claimants publish official updates" on public.team_fanfeed_posts;
create policy "approved team claimants publish official updates"
  on public.team_fanfeed_posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.profile_claim_requests c
      where c.entity_type = 'team'
        and c.entity_id = team_fanfeed_posts.team_id
        and c.requester_id = (select auth.uid())
        and c.status = 'approved'
    )
  );

drop policy if exists "approved team claimants manage own official updates" on public.team_fanfeed_posts;
create policy "approved team claimants manage own official updates"
  on public.team_fanfeed_posts for update to authenticated
  using (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.profile_claim_requests c
      where c.entity_type = 'team'
        and c.entity_id = team_fanfeed_posts.team_id
        and c.requester_id = (select auth.uid())
        and c.status = 'approved'
    )
  )
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.profile_claim_requests c
      where c.entity_type = 'team'
        and c.entity_id = team_fanfeed_posts.team_id
        and c.requester_id = (select auth.uid())
        and c.status = 'approved'
    )
  );

drop policy if exists "approved team claimants delete own official updates" on public.team_fanfeed_posts;
create policy "approved team claimants delete own official updates"
  on public.team_fanfeed_posts for delete to authenticated
  using (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.profile_claim_requests c
      where c.entity_type = 'team'
        and c.entity_id = team_fanfeed_posts.team_id
        and c.requester_id = (select auth.uid())
        and c.status = 'approved'
    )
  );

grant select, insert, update, delete on public.team_fanfeed_posts to authenticated;
grant all on public.team_fanfeed_posts to service_role;
