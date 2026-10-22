-- Dedicated fan HoopFeed data model. Player feed tables and policies are intentionally untouched.
create table if not exists public.fan_feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 500),
  image_url text,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint fan_feed_posts_body_or_image check (length(trim(body)) > 0 or image_url is not null)
);
create index if not exists fan_feed_posts_team_created_idx on public.fan_feed_posts(team_id, created_at desc);
create index if not exists fan_feed_posts_author_created_idx on public.fan_feed_posts(author_id, created_at desc);
create index if not exists fan_feed_posts_expiry_idx on public.fan_feed_posts(expires_at);

create table if not exists public.fan_feed_likes (
  post_id uuid not null references public.fan_feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create table if not exists public.fan_feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.fan_feed_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists fan_feed_comments_post_created_idx on public.fan_feed_comments(post_id,created_at);

alter table public.fan_feed_posts enable row level security;
alter table public.fan_feed_likes enable row level security;
alter table public.fan_feed_comments enable row level security;

drop policy if exists "fan feed posts visible to fans" on public.fan_feed_posts;
create policy "fan feed posts visible to fans" on public.fan_feed_posts for select to authenticated
using (
  status='approved' and expires_at>now()
  and exists (
    select 1 from public.profiles viewer join public.subscriptions sub on sub.user_id=viewer.id
    where viewer.id=(select auth.uid()) and viewer.account_type='fan'
      and sub.plan in ('pro','premium') and sub.status in ('active','trialing')
      and coalesce(sub.access_status,'active') in ('active','trialing','pro','premium')
      and (
        author_id=viewer.id
        or exists(select 1 from public.follow_relationships fr where fr.follower_id=viewer.id and fr.target_type='fan' and fr.target_id=author_id)
        or exists(select 1 from public.follow_relationships tr where tr.follower_id=viewer.id and tr.target_type='team' and tr.target_id=team_id)
      )
  )
);
drop policy if exists "fan feed authors delete own posts" on public.fan_feed_posts;
create policy "fan feed authors delete own posts" on public.fan_feed_posts for delete to authenticated
using (author_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan'));

drop policy if exists "fan feed likes visible with post" on public.fan_feed_likes;
create policy "fan feed likes visible with post" on public.fan_feed_likes for select to authenticated
using (exists (select 1 from public.fan_feed_posts fp where fp.id=fan_feed_likes.post_id));
drop policy if exists "fans like fan posts" on public.fan_feed_likes;
create policy "fans like fan posts" on public.fan_feed_likes for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan') and exists (select 1 from public.fan_feed_posts fp where fp.id=fan_feed_likes.post_id));
drop policy if exists "fans remove own likes" on public.fan_feed_likes;
create policy "fans remove own likes" on public.fan_feed_likes for delete to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan'));

drop policy if exists "fan feed comments visible with post" on public.fan_feed_comments;
create policy "fan feed comments visible with post" on public.fan_feed_comments for select to authenticated
using (exists (select 1 from public.fan_feed_posts fp where fp.id=fan_feed_comments.post_id));
drop policy if exists "fans comment on fan posts" on public.fan_feed_comments;
create policy "fans comment on fan posts" on public.fan_feed_comments for insert to authenticated
with check (author_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan') and exists (select 1 from public.fan_feed_posts fp where fp.id=fan_feed_comments.post_id));
drop policy if exists "fans delete own fan comments" on public.fan_feed_comments;
create policy "fans delete own fan comments" on public.fan_feed_comments for delete to authenticated
using (author_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan'));

grant select, delete on public.fan_feed_posts to authenticated;
grant select, insert, delete on public.fan_feed_likes to authenticated;
grant select, insert, delete on public.fan_feed_comments to authenticated;
