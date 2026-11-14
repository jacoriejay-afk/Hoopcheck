-- REELS-1 DRAFT SCHEMA — REVIEW ONLY, NOT A MIGRATION.
-- Convert using Supabase CLI migration new after reconciling live schema.
-- Deliberately no client GRANT or storage access policy: default deny until
-- server-authoritative entitlement, block, visibility and moderation checks exist.
-- Do not apply to production as-is.

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  video_url text not null,
  poster_url text,
  caption text not null default '' check (char_length(caption) <= 300),
  duration_sec numeric(6,2) not null check (duration_sec > 0 and duration_sec <= 90),
  club_id uuid references public.teams(id),
  league_id uuid references public.leagues(id),
  linked_profile_id uuid references public.profiles(id),
  visibility text not null default 'public' check (visibility in ('public','followers')),
  status text not null default 'under_review' check (status in ('active','under_review','removed')),
  checks_count integer not null default 0 check (checks_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  created_at timestamptz not null default now(),
  constraint reels_single_tag check (
    num_nonnulls(club_id,league_id,linked_profile_id) <= 1
  )
);
create index if not exists reels_author_created_idx on public.reels(author_id, created_at desc);
create index if not exists reels_status_created_idx on public.reels(status, created_at desc);
create index if not exists reels_club_idx on public.reels(club_id) where club_id is not null;
create index if not exists reels_league_idx on public.reels(league_id) where league_id is not null;

create table if not exists public.reel_checks (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (reel_id,user_id)
);
create table if not exists public.reel_bookmarks (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (reel_id,user_id)
);
create table if not exists public.reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  status text not null default 'under_review' check (status in ('active','under_review','removed')),
  created_at timestamptz not null default now()
);
create index if not exists reel_comments_reel_created_idx on public.reel_comments(reel_id,created_at desc);

alter table public.reels enable row level security;
alter table public.reel_checks enable row level security;
alter table public.reel_bookmarks enable row level security;
alter table public.reel_comments enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies yet. New tables are inaccessible
-- to normal clients until verified authorization functions and JWT tests land.
-- No public storage bucket. Use private objects + authorized delivery.
-- Never trust client-supplied counts, status, author_id or verification.
