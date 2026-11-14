-- Store one directory tag and an explicitly entered location per HoopFeed post.
alter table public.feed_posts
  add column if not exists club_id uuid references public.teams(id) on delete set null,
  add column if not exists womens_club_id uuid references public.womens_teams(id) on delete set null,
  add column if not exists league_id uuid references public.leagues(id) on delete set null,
  add column if not exists womens_league_id uuid references public.womens_leagues(id) on delete set null,
  add column if not exists post_location text,
  add column if not exists community_pinned_at timestamptz,
  add column if not exists community_visible boolean not null default false,
  add constraint feed_posts_one_entity check (num_nonnulls(club_id, womens_club_id, league_id, womens_league_id) <= 1),
  add constraint feed_posts_location_length check (char_length(post_location) between 1 and 100);

create index feed_posts_club_created_idx on public.feed_posts (club_id, created_at desc) where club_id is not null;
create index feed_posts_womens_club_created_idx on public.feed_posts (womens_club_id, created_at desc) where womens_club_id is not null;
create index feed_posts_league_created_idx on public.feed_posts (league_id, created_at desc) where league_id is not null;
create index feed_posts_womens_league_created_idx on public.feed_posts (womens_league_id, created_at desc) where womens_league_id is not null;

-- Extend the same relationship table used by profile follows and feed visibility.
alter table public.follow_relationships add constraint follow_relationships_no_self
  check (follower_id <> target_id or target_type not in ('player', 'fan')) not valid;

-- Count only Check rows visible to the caller under existing HoopFeed RLS.
create function public.get_hoopfeed_check_totals(post_ids uuid[])
returns table(post_id uuid, checks_count bigint, checked_by_me boolean)
language sql stable security invoker set search_path = ''
as $$
  select c.post_id, count(*), bool_or(c.user_id = (select auth.uid()))
  from public.feed_post_checks c
  where c.post_id = any(post_ids)
  group by c.post_id;
$$;
revoke execute on function public.get_hoopfeed_check_totals(uuid[]) from public, anon;
grant execute on function public.get_hoopfeed_check_totals(uuid[]) to authenticated;

create function public.get_hoopfeed_poll_totals(post_ids uuid[])
returns table(post_id uuid, option_index integer, votes_count bigint, voted_by_me boolean)
language sql stable security invoker set search_path = ''
as $$
  select v.post_id, v.option_index, count(*), bool_or(v.user_id = (select auth.uid()))
  from public.feed_poll_votes v
  where v.post_id = any(post_ids)
  group by v.post_id, v.option_index;
$$;
revoke execute on function public.get_hoopfeed_poll_totals(uuid[]) from public, anon;
grant execute on function public.get_hoopfeed_poll_totals(uuid[]) to authenticated;

-- Existing posts retain their visibility. New posts explicitly opt into the
-- community audience, which also requires a public author profile.
create function private.hoopfeed_can_read_post_author(p_author_id uuid, p_community_visible boolean)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.hoopfeed_can_read_author(p_author_id)
    or (
      p_community_visible
      and auth.uid() is not null
      and exists (
        select 1 from public.profiles author
        where author.id = p_author_id and author.profile_visibility = 'public'
      )
      and not exists (
        select 1 from public.user_blocks block
        where (block.blocker_id = auth.uid() and block.blocked_id = p_author_id)
           or (block.blocker_id = p_author_id and block.blocked_id = auth.uid())
      )
    );
$$;
revoke all on function private.hoopfeed_can_read_post_author(uuid, boolean) from public, anon;
grant execute on function private.hoopfeed_can_read_post_author(uuid, boolean) to authenticated;

create or replace function private.hoopfeed_can_read_reshare_source(p_source_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  with recursive sources as (
    select id, shared_post_id, author_id, status, expires_at, community_visible
    from public.feed_posts where id = p_source_id
    union
    select post.id, post.shared_post_id, post.author_id, post.status, post.expires_at, post.community_visible
    from public.feed_posts post join sources on sources.shared_post_id = post.id
  )
  select coalesce(bool_or(shared_post_id is null), false)
    and coalesce(bool_and(
      status = 'approved'
      and (expires_at is null or expires_at > now())
      and private.hoopfeed_can_read_post_author(author_id, community_visible)
    ), false)
  from sources;
$$;

alter policy "unified hoopfeed approved posts read" on public.feed_posts to authenticated
using (
  (
    status = 'approved'
    and (expires_at is null or expires_at > now())
    and (select public.can_use_unified_hoopfeed())
    and private.hoopfeed_can_read_post_author(author_id, community_visible)
    and (shared_post_id is null or private.hoopfeed_can_read_reshare_source(shared_post_id))
  )
  or (
    status <> 'approved'
    and (author_id = (select auth.uid()) or (select public.is_current_user_admin_or_moderator()))
  )
);
