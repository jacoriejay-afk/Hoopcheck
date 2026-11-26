-- REVIEW ONLY. Do not apply to any hosted database. #1049 phase 1.
-- Additive private claim intake; does NOT change existing review authorization.
begin;
create table public.player_team_season_claims (
 id uuid primary key default gen_random_uuid(),
 player_id uuid not null references public.profiles(id) on delete cascade,
 team_id uuid references public.teams(id) on delete restrict,
 womens_team_id uuid references public.womens_teams(id) on delete restrict,
 season_start_year smallint not null check (season_start_year between 1900 and 2200),
 season_end_year smallint not null,
 start_date date,
 end_date date,
 verification_status text not null default 'pending'
   check (verification_status in ('pending','verified','rejected','revoked')),
 created_at timestamptz not null default now(),
 check (num_nonnulls(team_id,womens_team_id) = 1),
 check (season_end_year in (season_start_year,season_start_year + 1)),
 check (start_date is null or extract(year from start_date) between season_start_year and season_end_year),
 check (end_date is null or extract(year from end_date) between season_start_year and season_end_year),
 check (start_date is null or end_date is null or start_date <= end_date)
);
create unique index player_season_claim_team_unique on public.player_team_season_claims
 (player_id,team_id,season_start_year,season_end_year) where team_id is not null;
create unique index player_season_claim_womens_team_unique on public.player_team_season_claims
 (player_id,womens_team_id,season_start_year,season_end_year) where womens_team_id is not null;
alter table public.player_team_season_claims enable row level security;
revoke all on public.player_team_season_claims from public, anon, authenticated;
grant select on public.player_team_season_claims to authenticated;
-- Never grant client write access to verification_status or any review decision.
grant insert (player_id,team_id,womens_team_id,season_start_year,season_end_year,start_date,end_date)
 on public.player_team_season_claims to authenticated;
grant select, insert, update, delete on public.player_team_season_claims to service_role;
create policy "player reads own season claims" on public.player_team_season_claims
 for select to authenticated using (player_id = (select auth.uid()));
create policy "player submits own pending season claim" on public.player_team_season_claims
 for insert to authenticated with check (
   player_id = (select auth.uid())
   and verification_status = 'pending'
   and season_start_year <= extract(year from current_date)
   and (start_date is null or start_date <= current_date)
   and exists (
     select 1 from public.profiles p where p.id = (select auth.uid())
       and p.account_type = 'player'
   )
 );
-- No authenticated update/delete policy. Correction/appeal and independently audited
-- verification are separate steps; no client, team manager, or ordinary moderator
-- approval endpoint is added here. No evidence files or public projection.
commit;
