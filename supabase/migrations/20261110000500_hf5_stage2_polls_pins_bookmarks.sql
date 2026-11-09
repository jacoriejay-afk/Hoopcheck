-- HF-5 Stage 2 migration (approved by Jacorie 2026-11-10 00:00 Baku)
-- Additive only: new columns with defaults + two new tables. Nothing altered or deleted.

alter table public.feed_posts add column if not exists post_kind text not null default 'discussion';
alter table public.feed_posts add column if not exists poll_options jsonb;
alter table public.feed_posts add column if not exists image_urls jsonb not null default '[]'::jsonb;
alter table public.feed_posts add column if not exists is_pinned boolean not null default false;
alter table public.feed_posts add column if not exists pinned_at timestamptz;

create table if not exists public.feed_poll_votes (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_index int not null check (option_index >= 0 and option_index < 10),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists feed_poll_votes_post_idx on public.feed_poll_votes(post_id);

create table if not exists public.feed_post_bookmarks (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists feed_post_bookmarks_user_idx on public.feed_post_bookmarks(user_id);

alter table public.feed_poll_votes enable row level security;
alter table public.feed_post_bookmarks enable row level security;

drop policy if exists "feed poll votes read" on public.feed_poll_votes;
create policy "feed poll votes read" on public.feed_poll_votes for select to authenticated using (true);
drop policy if exists "feed poll votes insert own" on public.feed_poll_votes;
create policy "feed poll votes insert own" on public.feed_poll_votes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "feed poll votes update own" on public.feed_poll_votes;
create policy "feed poll votes update own" on public.feed_poll_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "feed poll votes delete own" on public.feed_poll_votes;
create policy "feed poll votes delete own" on public.feed_poll_votes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "feed bookmarks read own" on public.feed_post_bookmarks;
create policy "feed bookmarks read own" on public.feed_post_bookmarks for select to authenticated using (user_id = auth.uid());
drop policy if exists "feed bookmarks insert own" on public.feed_post_bookmarks;
create policy "feed bookmarks insert own" on public.feed_post_bookmarks for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "feed bookmarks delete own" on public.feed_post_bookmarks;
create policy "feed bookmarks delete own" on public.feed_post_bookmarks for delete to authenticated using (user_id = auth.uid());

notify pgrst, 'reload schema';
