-- HoopCheck launch: HoopFeed social interactions, photos, and avatar upload persistence

alter table public.feed_posts add column if not exists image_url text;

create table if not exists public.feed_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists feed_post_comments_post_created_idx on public.feed_post_comments(post_id, created_at desc);
create index if not exists feed_post_comments_author_idx on public.feed_post_comments(author_id);
alter table public.feed_post_comments enable row level security;

create table if not exists public.feed_post_checks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id,user_id)
);
create index if not exists feed_post_checks_post_idx on public.feed_post_checks(post_id);
create index if not exists feed_post_checks_user_idx on public.feed_post_checks(user_id);
alter table public.feed_post_checks enable row level security;

drop policy if exists "player feed comments read" on public.feed_post_comments;
drop policy if exists "player feed comments insert" on public.feed_post_comments;
drop policy if exists "player feed comments delete own" on public.feed_post_comments;
drop policy if exists "player feed checks read" on public.feed_post_checks;
drop policy if exists "player feed checks insert" on public.feed_post_checks;
drop policy if exists "player feed checks delete own" on public.feed_post_checks;
drop policy if exists "player feed post delete own" on public.feed_posts;
drop policy if exists "player feed post update own" on public.feed_posts;
drop policy if exists "feed images insert own" on storage.objects;
drop policy if exists "feed images update own" on storage.objects;
drop policy if exists "feed images delete own" on storage.objects;
drop policy if exists "profile avatars select own" on storage.objects;

create policy "player feed comments read" on public.feed_post_comments for select to authenticated using (
  exists (select 1 from public.feed_posts fp where fp.id=post_id and fp.expires_at>now() and public.can_view_player_feed_post(fp.author_id))
);
create policy "player feed comments insert" on public.feed_post_comments for insert to authenticated with check (
  author_id=(select auth.uid()) and exists (
    select 1 from public.profiles p join public.subscriptions s on s.user_id=p.id join public.feed_posts fp on fp.id=post_id
    where p.id=(select auth.uid()) and p.account_type='player' and s.plan in ('pro','premium') and s.status in ('active','trialing')
      and coalesce(s.access_status,'active') in ('active','trialing','pro','premium') and fp.expires_at>now()
      and public.can_view_player_feed_post(fp.author_id)
  )
);
create policy "player feed comments delete own" on public.feed_post_comments for delete to authenticated using (author_id=(select auth.uid()));

create policy "player feed checks read" on public.feed_post_checks for select to authenticated using (
  exists (select 1 from public.feed_posts fp where fp.id=post_id and fp.expires_at>now() and public.can_view_player_feed_post(fp.author_id))
);
create policy "player feed checks insert" on public.feed_post_checks for insert to authenticated with check (
  user_id=(select auth.uid()) and exists (
    select 1 from public.profiles p join public.subscriptions s on s.user_id=p.id join public.feed_posts fp on fp.id=post_id
    where p.id=(select auth.uid()) and p.account_type='player' and s.plan in ('pro','premium') and s.status in ('active','trialing')
      and coalesce(s.access_status,'active') in ('active','trialing','pro','premium') and fp.expires_at>now()
      and public.can_view_player_feed_post(fp.author_id)
  )
);
create policy "player feed checks delete own" on public.feed_post_checks for delete to authenticated using (user_id=(select auth.uid()));

create policy "player feed post delete own" on public.feed_posts for delete to authenticated using (author_id=(select auth.uid()));
create policy "player feed post update own" on public.feed_posts for update to authenticated using (author_id=(select auth.uid())) with check (author_id=(select auth.uid()));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('feed-images','feed-images',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy "feed images insert own" on storage.objects for insert to authenticated with check (bucket_id='feed-images' and (storage.foldername(name))[1]=(select (auth.uid())::text));
create policy "feed images update own" on storage.objects for update to authenticated using (bucket_id='feed-images' and (storage.foldername(name))[1]=(select (auth.uid())::text)) with check (bucket_id='feed-images' and (storage.foldername(name))[1]=(select (auth.uid())::text));
create policy "feed images delete own" on storage.objects for delete to authenticated using (bucket_id='feed-images' and (storage.foldername(name))[1]=(select (auth.uid())::text));

create policy "profile avatars select own" on storage.objects for select to authenticated using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select (auth.uid())::text));
