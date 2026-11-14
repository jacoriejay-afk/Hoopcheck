-- REELS-1 PHASE A: additive default-deny tables only.
-- No upload, publishing, playback or direct client permissions are enabled.
-- Apply only through reviewed migrations after verifying against production schema.

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  -- Private Storage coordinates, NEVER a public URL or long-lived signed URL.
  video_bucket text not null default 'hoopfeed-private-videos'
    check (video_bucket = 'hoopfeed-private-videos'),
  video_object_path text not null unique,
  poster_object_path text,
  mime_type text not null check (mime_type in ('video/mp4','video/webm','video/quicktime')),
  byte_size bigint not null check (byte_size between 1 and 104857600),
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
  constraint reels_owner_path check (
    video_object_path like ('reels/' || author_id::text || '/' || id::text || '/original.%')
    and video_object_path = 'reels/' || author_id::text || '/' || id::text || '/original.' ||
      case mime_type when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' else 'mov' end
  ),
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

-- Delivery must resolve the exact stored path only after checking the viewer's
-- current subscription, blocks, author visibility, and reel moderation state.
-- A reel row is NOT a grant to sign an arbitrary Storage path.

-- Explicitly override any existing default table grants. Supabase projects may
-- grant privileges on newly created public tables to authenticated by default;
-- RLS with zero policies is a second, independent deny boundary.
revoke all on table public.reels from anon, authenticated;
revoke all on table public.reel_checks from anon, authenticated;
revoke all on table public.reel_bookmarks from anon, authenticated;
revoke all on table public.reel_comments from anon, authenticated;

-- Lock down any identity-backed table reads and writes until JWT fixtures and
-- author/follower/block/moderation policy tests have passed.
-- IMPORTANT: service_role can bypass RLS and must be used server-side only.
