-- HoopCheck: trust score inputs, category ratings, career journey, claims, and live hub support.
-- Source-only migration: do not apply to production until reviewed and explicitly approved.

-- Team locations are directory metadata, not user location tracking.
alter table public.teams
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6);

-- Schedule and display metadata needed by the Live Games hub.
alter table public.fan_live_games
  add column if not exists scheduled_at timestamptz,
  add column if not exists league_id uuid references public.leagues(id) on delete set null,
  add column if not exists league_name text,
  add column if not exists country text,
  add column if not exists period_label text;

create index if not exists fan_live_games_scheduled_at_idx
  on public.fan_live_games(scheduled_at)
  where scheduled_at is not null;

-- Seven signing-decision category ratings. communication_rating already exists.
alter table public.reviews
  add column if not exists pay_on_time_rating numeric(2,1) check (pay_on_time_rating between 1 and 5),
  add column if not exists housing_rating numeric(2,1) check (housing_rating between 1 and 5),
  add column if not exists medical_support_rating numeric(2,1) check (medical_support_rating between 1 and 5),
  add column if not exists coaching_quality_rating numeric(2,1) check (coaching_quality_rating between 1 and 5),
  add column if not exists facilities_rating numeric(2,1) check (facilities_rating between 1 and 5),
  add column if not exists playing_time_honesty_rating numeric(2,1) check (playing_time_honesty_rating between 1 and 5);

create or replace function public.compute_review_overall_rating()
returns trigger
language plpgsql
set search_path = public
as $$
declare calculated numeric;
begin
  select round(avg(value)::numeric, 2)
    into calculated
  from unnest(array[
    new.pay_on_time_rating,
    new.housing_rating,
    new.medical_support_rating,
    new.communication_rating,
    new.coaching_quality_rating,
    new.facilities_rating,
    new.playing_time_honesty_rating
  ]) as ratings(value)
  where value is not null;

  -- Preserve historical overall ratings for legacy rows/clients that do not
  -- submit the new category fields yet. The updated form supplies all seven.
  if calculated is not null then
    new.overall_rating := calculated;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_compute_overall_rating on public.reviews;
create trigger reviews_compute_overall_rating
before insert or update of pay_on_time_rating, housing_rating, medical_support_rating,
  communication_rating, coaching_quality_rating, facilities_rating, playing_time_honesty_rating
on public.reviews
for each row execute function public.compute_review_overall_rating();

-- Player Journey: private by default; only the owner with an active Premium
-- player membership can create/edit stops. Public visibility is explicitly opt-in.
create table if not exists public.player_career_stops (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  team_name text not null,
  league_name text,
  country text not null,
  seasons text not null,
  position text,
  stop_order integer not null default 0,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_career_stops_order_nonnegative check (stop_order >= 0)
);
create index if not exists player_career_stops_player_order_idx
  on public.player_career_stops(player_id, stop_order, created_at);
alter table public.player_career_stops enable row level security;
drop policy if exists "players can view public journey stops" on public.player_career_stops;
create policy "players can view public journey stops"
  on public.player_career_stops for select to anon, authenticated
  using (is_public = true);
drop policy if exists "players can view own journey stops" on public.player_career_stops;
create policy "players can view own journey stops"
  on public.player_career_stops for select to authenticated
  using (player_id = (select auth.uid()));
drop policy if exists "premium players manage own journey stops" on public.player_career_stops;
create policy "premium players manage own journey stops"
  on public.player_career_stops for all to authenticated
  using (
    player_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      join public.subscriptions s on s.user_id = p.id
      where p.id = (select auth.uid()) and p.account_type = 'player'
        and s.plan = 'premium' and s.status in ('active','trialing')
        and (s.current_period_end is null or s.current_period_end > now())
    )
  )
  with check (
    player_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      join public.subscriptions s on s.user_id = p.id
      where p.id = (select auth.uid()) and p.account_type = 'player'
        and s.plan = 'premium' and s.status in ('active','trialing')
        and (s.current_period_end is null or s.current_period_end > now())
    )
  );

-- Explicit opt-in for displaying a player's current country on social posts.
alter table public.profiles
  add column if not exists current_country_public boolean not null default false;
alter table public.feed_posts
  add column if not exists show_country boolean not null default false,
  add column if not exists team_tag_id uuid references public.teams(id) on delete set null;

-- Organization claim queue. Proof URLs must point to a private storage location;
-- do not store uploaded documents in a publicly readable bucket.
create table if not exists public.profile_claim_requests (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('team','coach')),
  entity_id uuid not null,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  organization_email text,
  verification_method text not null check (verification_method in ('official_email','document')),
  proof_document_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profile_claim_proof_check check (
    (verification_method = 'official_email' and organization_email is not null)
    or (verification_method = 'document' and proof_document_path is not null)
  )
);
create index if not exists profile_claim_requests_status_created_idx
  on public.profile_claim_requests(status, created_at desc);
create index if not exists profile_claim_requests_entity_idx
  on public.profile_claim_requests(entity_type, entity_id, status);
alter table public.profile_claim_requests enable row level security;
drop policy if exists "claim request owners can read own" on public.profile_claim_requests;
create policy "claim request owners can read own"
  on public.profile_claim_requests for select to authenticated
  using (requester_id = (select auth.uid()) or public.is_current_user_admin_or_moderator());
drop policy if exists "users can submit profile claims" on public.profile_claim_requests;
create policy "users can submit profile claims"
  on public.profile_claim_requests for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');
drop policy if exists "admins manage profile claim queue" on public.profile_claim_requests;
create policy "admins manage profile claim queue"
  on public.profile_claim_requests for update to authenticated
  using (public.is_current_user_admin_or_moderator())
  with check (public.is_current_user_admin_or_moderator());

-- One immutable official response per review; response access is separate from
-- review moderation. Organization claims do not grant review edit/delete rights.
create table if not exists public.review_official_responses (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews(id) on delete cascade,
  entity_type text not null check (entity_type in ('team','coach')),
  entity_id uuid not null,
  responder_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.review_official_responses enable row level security;
drop policy if exists "official responses visible with approved review" on public.review_official_responses;
create policy "official responses visible with approved review"
  on public.review_official_responses for select to anon, authenticated
  using (
    exists (select 1 from public.reviews r where r.id = review_id and r.status = 'approved')
    or responder_id = (select auth.uid())
    or public.is_current_user_admin_or_moderator()
  );
drop policy if exists "approved claim owners may respond once" on public.review_official_responses;
create policy "approved claim owners may respond once"
  on public.review_official_responses for insert to authenticated
  with check (
    responder_id = (select auth.uid())
    and exists (
      select 1 from public.profile_claim_requests c
      where c.entity_type = review_official_responses.entity_type
        and c.entity_id = review_official_responses.entity_id
        and c.requester_id = (select auth.uid())
        and c.status = 'approved'
    )
    and exists (
      select 1 from public.reviews r
      where r.id = review_official_responses.review_id
        and r.status = 'approved'
        and (
          (review_official_responses.entity_type = 'team' and r.team_id = review_official_responses.entity_id)
          or (review_official_responses.entity_type = 'coach' and r.coach_id = review_official_responses.entity_id)
        )
    )
  );

-- Per-user reminder records for the existing per-game chat.
create table if not exists public.fan_live_game_reminders (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.fan_live_games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(game_id, user_id)
);
alter table public.fan_live_game_reminders enable row level security;
drop policy if exists "users manage own game reminders" on public.fan_live_game_reminders;
create policy "users manage own game reminders"
  on public.fan_live_game_reminders for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Real chat presence: counts only users with a fresh heartbeat, never a fabricated value.
create table if not exists public.fan_live_chat_presence (
  game_id uuid not null references public.fan_live_games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index if not exists fan_live_chat_presence_fresh_idx
  on public.fan_live_chat_presence(game_id, last_seen_at desc);
alter table public.fan_live_chat_presence enable row level security;
drop policy if exists "eligible fans read game presence" on public.fan_live_chat_presence;
create policy "eligible fans read game presence"
  on public.fan_live_chat_presence for select to authenticated
  using (
    exists (
      select 1 from public.fan_live_games g
      join public.profiles p on p.id = (select auth.uid())
      join public.subscriptions s on s.user_id = p.id
      where g.id = fan_live_chat_presence.game_id
        and p.account_type = 'fan' and s.plan in ('pro','premium')
        and s.status in ('active','trialing')
        and (s.current_period_end is null or s.current_period_end > now())
        and exists (
          select 1 from public.follow_relationships f
          where f.follower_id = (select auth.uid()) and f.target_type = 'team'
            and f.target_id in (g.team_id, g.opponent_team_id)
        )
    ) or public.is_current_user_admin_or_moderator()
  );
drop policy if exists "eligible fans publish own game presence" on public.fan_live_chat_presence;
create policy "eligible fans publish own game presence"
  on public.fan_live_chat_presence for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.fan_live_games g
      join public.profiles p on p.id = (select auth.uid())
      join public.subscriptions s on s.user_id = p.id
      where g.id = fan_live_chat_presence.game_id
        and p.account_type = 'fan' and s.plan in ('pro','premium')
        and s.status in ('active','trialing')
        and (s.current_period_end is null or s.current_period_end > now())
        and exists (
          select 1 from public.follow_relationships f
          where f.follower_id = (select auth.uid()) and f.target_type = 'team'
            and f.target_id in (g.team_id, g.opponent_team_id)
        )
    )
  );
drop policy if exists "eligible fans update own game presence" on public.fan_live_chat_presence;
create policy "eligible fans update own game presence"
  on public.fan_live_chat_presence for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Optional alert controls extend the existing per-target watchlist.
alter table public.user_watchlists
  add column if not exists muted boolean not null default false,
  add column if not exists alert_trust_score boolean not null default true,
  add column if not exists alert_roster_spots boolean not null default true,
  add column if not exists alert_pay_warning boolean not null default true;
