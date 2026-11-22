-- Applied to HoopCheck production on 2026-11-22; Supabase migration history version matches this filename.
-- Additive migration reconciled with separately rehearsed review candidate; do not rewrite applied history.
-- REVIEW-ONLY CANDIDATE. Do not apply to HoopCheck production or mark Passport active
-- until schema-equivalent rehearsal, real owner/non-owner authenticated tests,
-- protected migration authorization and an approved versioned rollout are complete.
-- Isolated additive replacement for ONLY the career table portion of
-- 20261019140000_trust_journey_claims_live_hub.sql; never replay that broad file.
create table if not exists public.player_career_stops (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  team_name text not null check (char_length(trim(team_name)) between 1 and 160),
  league_name text check (league_name is null or char_length(league_name) <= 160),
  country text not null check (char_length(trim(country)) between 1 and 100),
  seasons text not null check (char_length(trim(seasons)) between 1 and 80),
  position text check (position is null or char_length(position) <= 60),
  stop_order integer not null default 0 check (stop_order >= 0),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists player_career_stops_player_order_idx
  on public.player_career_stops(player_id, stop_order, created_at);
alter table public.player_career_stops enable row level security;

-- Explicit table grants and separate policies; public reads ONLY opted-in stops.
revoke all on public.player_career_stops from public, anon, authenticated;
grant select on public.player_career_stops to anon, authenticated;
grant insert, update, delete on public.player_career_stops to authenticated;

create policy "career stops public opt-in read"
  on public.player_career_stops for select to anon, authenticated
  using (is_public is true);

create policy "career stops private owner read"
  on public.player_career_stops for select to authenticated
  using (player_id = (select auth.uid()));

-- Same Premium Player requirement as existing app/RLS contract; do not silently
-- broaden to free users or fans. All changes require matching caller ownership.
create policy "career stops eligible owner insert"
  on public.player_career_stops for insert to authenticated
  with check (
    player_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      join public.subscriptions s on s.user_id=p.id
      where p.id=(select auth.uid()) and p.account_type='player'
        and s.plan='premium' and s.status in ('active','trialing')
        and (s.current_period_end is null or s.current_period_end>now())
    )
  );
create policy "career stops eligible owner update"
  on public.player_career_stops for update to authenticated
  using (
    player_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      join public.subscriptions s on s.user_id=p.id
      where p.id=(select auth.uid()) and p.account_type='player'
        and s.plan='premium' and s.status in ('active','trialing')
        and (s.current_period_end is null or s.current_period_end>now())
    )
  )
  with check (
    player_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      join public.subscriptions s on s.user_id=p.id
      where p.id=(select auth.uid()) and p.account_type='player'
        and s.plan='premium' and s.status in ('active','trialing')
        and (s.current_period_end is null or s.current_period_end>now())
    )
  );
create policy "career stops eligible owner delete"
  on public.player_career_stops for delete to authenticated
  using (
    player_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      join public.subscriptions s on s.user_id=p.id
      where p.id=(select auth.uid()) and p.account_type='player'
        and s.plan='premium' and s.status in ('active','trialing')
        and (s.current_period_end is null or s.current_period_end>now())
    )
  );
