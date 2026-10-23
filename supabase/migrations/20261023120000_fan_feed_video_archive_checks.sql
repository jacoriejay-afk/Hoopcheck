-- Fan HoopFeed media, Check reactions, and private per-user archive.
alter table public.fan_feed_posts add column if not exists video_url text;
alter table public.fan_feed_posts drop constraint if exists fan_feed_posts_body_or_image;
alter table public.fan_feed_posts add constraint fan_feed_posts_body_or_media
  check (length(trim(body)) > 0 or image_url is not null or video_url is not null);

create table if not exists public.fan_feed_checks (
  post_id uuid not null references public.fan_feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);
alter table public.fan_feed_checks enable row level security;
drop policy if exists "fan checks visible with post" on public.fan_feed_checks;
create policy "fan checks visible with post" on public.fan_feed_checks for select to authenticated
  using (public.can_view_fan_feed_post(post_id));
drop policy if exists "fans check visible fan posts" on public.fan_feed_checks;
create policy "fans check visible fan posts" on public.fan_feed_checks for insert to authenticated
  with check (user_id=(select auth.uid()) and public.can_view_fan_feed_post(post_id));
drop policy if exists "fans remove own checks" on public.fan_feed_checks;
create policy "fans remove own checks" on public.fan_feed_checks for delete to authenticated
  using (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan'));
grant select,insert,delete on public.fan_feed_checks to authenticated;

create table if not exists public.fan_feed_archives (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.fan_feed_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,post_id)
);
alter table public.fan_feed_archives enable row level security;
drop policy if exists "users read own fan archives" on public.fan_feed_archives;
create policy "users read own fan archives" on public.fan_feed_archives for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists "authors archive own fan posts" on public.fan_feed_archives;
create policy "authors archive own fan posts" on public.fan_feed_archives for insert to authenticated
  with check (user_id=(select auth.uid()) and exists(select 1 from public.fan_feed_posts p where p.id=post_id and p.author_id=(select auth.uid())));
drop policy if exists "users unarchive own fan posts" on public.fan_feed_archives;
create policy "users unarchive own fan posts" on public.fan_feed_archives for delete to authenticated
  using (user_id=(select auth.uid()));
grant select,insert,delete on public.fan_feed_archives to authenticated;

-- Shared public video bucket; uploads are scoped to the authenticated user's folder.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('feed-videos','feed-videos',true,52428800,array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=true,file_size_limit=52428800,allowed_mime_types=array['video/mp4','video/webm','video/quicktime'];
drop policy if exists "members upload own HoopFeed videos" on storage.objects;
create policy "members upload own HoopFeed videos" on storage.objects for insert to authenticated
  with check (bucket_id='feed-videos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "members delete own HoopFeed videos" on storage.objects;
create policy "members delete own HoopFeed videos" on storage.objects for delete to authenticated
  using (bucket_id='feed-videos' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Player HoopFeed archive is private to the author and does not hide a post for other followers.
alter table public.feed_posts add column if not exists video_url text;
create table if not exists public.feed_post_archives (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,post_id)
);
alter table public.feed_post_archives enable row level security;
drop policy if exists "authors read own HoopFeed archives" on public.feed_post_archives;
create policy "authors read own HoopFeed archives" on public.feed_post_archives for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists "authors archive own HoopFeed posts" on public.feed_post_archives;
create policy "authors archive own HoopFeed posts" on public.feed_post_archives for insert to authenticated
  with check (user_id=(select auth.uid()) and exists(select 1 from public.feed_posts p where p.id=post_id and p.author_id=(select auth.uid())));
drop policy if exists "authors unarchive own HoopFeed posts" on public.feed_post_archives;
create policy "authors unarchive own HoopFeed posts" on public.feed_post_archives for delete to authenticated
  using (user_id=(select auth.uid()));
grant select,insert,delete on public.feed_post_archives to authenticated;
