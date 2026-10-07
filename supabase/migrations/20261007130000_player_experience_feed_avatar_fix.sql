-- HoopCheck launch: player experience feed and public player avatar compatibility

alter table public.feed_posts
  add column if not exists expires_at timestamptz;

update public.feed_posts
set expires_at = created_at + interval '24 hours'
where expires_at is null;

alter table public.feed_posts
  alter column expires_at set default (now() + interval '24 hours');

create index if not exists feed_posts_expires_at_idx on public.feed_posts(expires_at);
create index if not exists feed_posts_author_created_idx on public.feed_posts(author_id, created_at desc);

create or replace function public.can_view_player_feed_post(p_author_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    p_author_id = (select auth.uid())
    or is_current_user_admin_or_moderator()
    or exists (
      select 1
      from public.profiles viewer
      join public.subscriptions sub on sub.user_id = viewer.id
      join public.follow_relationships fr
        on fr.follower_id = viewer.id
       and fr.target_type = 'player'
       and fr.target_id = p_author_id
      join public.profiles author on author.id = p_author_id
      where viewer.id = (select auth.uid())
        and viewer.account_type = 'player'
        and viewer.current_country is not null
        and author.account_type = 'player'
        and author.current_country is not null
        and lower(viewer.current_country) = lower(author.current_country)
        and sub.plan in ('pro','premium')
        and sub.status in ('active','trialing')
        and coalesce(sub.access_status,'active') in ('active','trialing')
    );
$$;

drop policy if exists "feed approved read" on public.feed_posts;
create policy "player experience feed read"
on public.feed_posts
for select
to authenticated
using (expires_at > now() and can_view_player_feed_post(author_id));

drop policy if exists "feed own insert" on public.feed_posts;
create policy "player experience feed insert"
on public.feed_posts
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    where p.id = (select auth.uid())
      and p.account_type = 'player'
      and s.plan in ('pro','premium')
      and s.status in ('active','trialing')
      and coalesce(s.access_status,'active') in ('active','trialing')
  )
);

create or replace function public.get_public_player_profile(p_user_id uuid)
returns table(
  id uuid,
  display_name text,
  avatar_url text,
  country text,
  bio text,
  player_position text,
  years_pro integer,
  current_country text,
  current_team text,
  player_verified boolean,
  player_verified_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    case
      when coalesce(p.avatar_moderation_status, 'approved') = 'approved' then p.avatar_url
      else null
    end,
    p.country,
    p.bio,
    p.position,
    p.years_pro,
    p.current_country,
    p.current_team,
    p.player_verified,
    p.player_verified_at
  from public.profiles p
  where p.id = p_user_id
    and p.account_type = 'player'
    and p.profile_visibility = 'public'
    and p.moderation_status <> 'suspended';
$$;
