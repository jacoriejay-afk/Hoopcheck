-- NATIVE-2 isolated schema foundation. Apply to sandbox only after review.
-- No changes to existing game chat, player verification or HoopFeed policies.
create table public.native2_travel_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 enabled boolean not null default false,
 country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
 selection_mode text not null default 'manual' check (selection_mode in ('manual','foreground')),
 updated_at timestamptz not null default now()
);
alter table public.native2_travel_preferences enable row level security;
create policy "native2 travel own read" on public.native2_travel_preferences
 for select to authenticated using (user_id = (select auth.uid()));
create policy "native2 travel own insert" on public.native2_travel_preferences
 for insert to authenticated with check (user_id = (select auth.uid()));
create policy "native2 travel own update" on public.native2_travel_preferences
 for update to authenticated using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));
create policy "native2 travel own delete" on public.native2_travel_preferences
 for delete to authenticated using (user_id = (select auth.uid()));
grant select,insert,update,delete on public.native2_travel_preferences to authenticated;

-- Only trusted backend code may create or alter attendance and media records.
-- The authenticated role receives read access only to its own records.
create table public.native2_arena_checkins (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 game_id uuid not null references public.fan_live_games(id) on delete cascade,
 checked_in_at timestamptz not null default now(),
 status text not null default 'pending' check (status in ('pending','verified','rejected')),
 unique (user_id,game_id)
);
alter table public.native2_arena_checkins enable row level security;
create policy "native2 attendance own read" on public.native2_arena_checkins
 for select to authenticated using (user_id = (select auth.uid()));
grant select on public.native2_arena_checkins to authenticated;

create table public.native2_highlight_assets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 private_storage_path text not null unique,
 status text not null default 'processing' check (status in ('processing','ready','failed')),
 watermark_applied boolean not null default false,
 end_card_applied boolean not null default false,
 created_at timestamptz not null default now(),
 check (status <> 'ready' or (watermark_applied and end_card_applied))
);
alter table public.native2_highlight_assets enable row level security;
create policy "native2 highlights own read" on public.native2_highlight_assets
 for select to authenticated using (owner_id = (select auth.uid()));
grant select on public.native2_highlight_assets to authenticated;

create table public.native2_verification_video_assets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null references public.player_verification_requests(id) on delete cascade,
 private_storage_path text not null unique,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '90 days'),
 unique (request_id)
);
alter table public.native2_verification_video_assets enable row level security;
create policy "native2 verification video own read" on public.native2_verification_video_assets
 for select to authenticated using (owner_id = (select auth.uid()));
grant select on public.native2_verification_video_assets to authenticated;
-- No public storage bucket or client-side insert/update grants.
-- Backend must validate ownership, check-in evidence and authorized reviewer access.
