-- REVIEW ONLY #1049: historical club snapshots and missing club request intake.
-- Apply only in disposable DB after the season claims candidate. Not a migration.
begin;
create table public.historical_club_seasons (
 id uuid primary key default gen_random_uuid(),
 team_id uuid references public.teams(id) on delete restrict,
 womens_team_id uuid references public.womens_teams(id) on delete restrict,
 season_start_year smallint not null check (season_start_year between 1900 and 2200),
 season_end_year smallint not null,
 historical_name text not null check (length(btrim(historical_name)) between 1 and 160),
 historical_league text not null check (length(btrim(historical_league)) between 1 and 160),
 historical_division text check (historical_division is null or length(btrim(historical_division)) between 1 and 100),
 historical_country text not null check (length(btrim(historical_country)) between 1 and 100),
 club_state text not null check (club_state in ('active','renamed','archived','unknown')),
 -- No private contract, evidence URL or player identity in the public directory.
 check (num_nonnulls(team_id,womens_team_id)=1),
 check (season_end_year in (season_start_year,season_start_year+1))
);
create unique index historical_mens_club_season_unique on public.historical_club_seasons(team_id,season_start_year,season_end_year) where team_id is not null;
create unique index historical_womens_club_season_unique on public.historical_club_seasons(womens_team_id,season_start_year,season_end_year) where womens_team_id is not null;
alter table public.historical_club_seasons enable row level security;
revoke all on public.historical_club_seasons from public, anon, authenticated;
grant select on public.historical_club_seasons to anon, authenticated;
grant select,insert,update,delete on public.historical_club_seasons to service_role;
create policy "published historical club season read" on public.historical_club_seasons for select to anon,authenticated using (true);
-- Private, independently reviewed provenance. No fuzzy-name mapping or automatic
-- successor equivalence. Historical rows must be created by trusted staff workflow.
create table public.historical_club_provenance (
 snapshot_id uuid primary key references public.historical_club_seasons(id) on delete restrict,
 verified_by uuid not null references public.profiles(id) on delete restrict,
 source_reference text not null check(length(btrim(source_reference)) between 1 and 1000),
 verified_at timestamptz not null default now()
);
alter table public.historical_club_provenance enable row level security;
revoke all on public.historical_club_provenance from public,anon,authenticated;
grant select,insert,update,delete on public.historical_club_provenance to service_role;
-- No historical snapshot can be published without separately recorded provenance.
-- Deferred FK supports atomic staff publication; no direct user access.
alter table public.historical_club_seasons add constraint historical_club_provenance_required
 foreign key(id) references public.historical_club_provenance(snapshot_id) deferrable initially deferred;
create table public.historical_club_requests (
 id uuid primary key default gen_random_uuid(),
 player_id uuid not null references public.profiles(id) on delete cascade,
 historical_name text not null check(length(btrim(historical_name)) between 1 and 160),
 country text not null check(length(btrim(country)) between 1 and 100),
 city text check(city is null or length(btrim(city)) between 1 and 100),
 league_name text not null check(length(btrim(league_name)) between 1 and 160),
 division text check(division is null or length(btrim(division)) between 1 and 100),
 basketball_type text not null check(basketball_type in ('mens','womens')),
 season_start_year smallint not null check(season_start_year between 1900 and 2200),
 season_end_year smallint not null,
 status text not null default 'pending' check(status in ('pending','resolved','rejected')),
 resolved_snapshot_id uuid references public.historical_club_seasons(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(season_end_year in (season_start_year,season_start_year+1)),
 check((status='resolved')=(resolved_snapshot_id is not null))
);
alter table public.historical_club_requests enable row level security;
revoke all on public.historical_club_requests from public,anon,authenticated;
grant select on public.historical_club_requests to authenticated;
grant insert(player_id,historical_name,country,city,league_name,division,basketball_type,season_start_year,season_end_year) on public.historical_club_requests to authenticated;
grant select,insert,update,delete on public.historical_club_requests to service_role;
create policy "owner reads historical requests" on public.historical_club_requests for select to authenticated using(player_id=(select auth.uid()));
create policy "player submits pending historical requests" on public.historical_club_requests for insert to authenticated with check(
 player_id=(select auth.uid()) and status='pending' and resolved_snapshot_id is null
 and season_start_year<=extract(year from current_date)
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='player')
);
-- Request resolution is not affiliation verification and cannot authorize reviews.
-- Snapshot identity mapping must be independently audited before linking claims.
commit;
