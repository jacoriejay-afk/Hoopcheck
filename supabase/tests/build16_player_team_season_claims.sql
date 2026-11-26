\set ON_ERROR_STOP on
-- Standalone disposable PostgreSQL only; never run against hosted data.
create schema auth;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin bypassrls;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
create table public.profiles(id uuid primary key, account_type text not null);
create table public.teams(id uuid primary key);
create table public.womens_teams(id uuid primary key);
grant select on public.profiles to authenticated;
insert into public.profiles values
 ('11111111-1111-1111-1111-111111111111','player'),
 ('22222222-2222-2222-2222-222222222222','player'),
 ('33333333-3333-3333-3333-333333333333','fan');
insert into public.teams values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into public.womens_teams values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
\i supabase/candidates/build16_player_team_season_claims_review_only.sql
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into public.player_team_season_claims(player_id,team_id,season_start_year,season_end_year)
 values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2022,2023),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2023,2024);
insert into public.player_team_season_claims(player_id,womens_team_id,season_start_year,season_end_year)
 values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',2023,2024);
do $$
begin
 if (select count(*) from public.player_team_season_claims where verification_status='pending') <> 3 then raise exception 'claims not pending'; end if;
 begin
 insert into public.player_team_season_claims(player_id,team_id,season_start_year,season_end_year)
 values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2022,2023);
 raise exception 'duplicate admitted'; exception when unique_violation then null; end;
 begin
 insert into public.player_team_season_claims(player_id,team_id,season_start_year,season_end_year,verification_status)
 values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2021,2022,'verified');
 raise exception 'self approval admitted'; exception when insufficient_privilege then null; end;
 begin
 update public.player_team_season_claims set verification_status='verified';
 raise exception 'self approval update admitted'; exception when insufficient_privilege then null; end;
 begin
 insert into public.player_team_season_claims(player_id,team_id,season_start_year,season_end_year)
 values ('22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2022,2023);
 raise exception 'forged ownership admitted'; exception when insufficient_privilege then null; end;
 begin
 insert into public.player_team_season_claims(player_id,team_id,womens_team_id,season_start_year,season_end_year)
 values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',2021,2022);
 raise exception 'two targets admitted'; exception when check_violation then null; end;
 begin
 insert into public.player_team_season_claims(player_id,team_id,season_start_year,season_end_year)
 values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2020,2023);
 raise exception 'invalid season admitted'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ begin
 if exists(select 1 from public.player_team_season_claims) then raise exception 'other player history leaked'; end if;
end $$;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
do $$ begin
 begin
 insert into public.player_team_season_claims(player_id,team_id,season_start_year,season_end_year)
 values ('33333333-3333-3333-3333-333333333333','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2022,2023);
 raise exception 'fan claim admitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.player_team_season_claims','SELECT') then raise exception 'anon read granted'; end if;
end $$;

-- Review guard fixture uses legacy permissive policies to prove restrictive
-- enforcement even for direct writes, without involving production.
alter table public.profiles add column player_verified boolean not null default true;
alter table public.profiles add column basketball_type text not null default 'womens';
create schema private;
grant usage on schema private to authenticated;
create function private.is_active_subscriber() returns boolean language sql stable
as $$ select coalesce(current_setting('fixture.paid',true),'') = 'yes' $$;
create table public.reviews (
 id uuid primary key default gen_random_uuid(), author_id uuid not null, team_id uuid,
 coach_id uuid, league_id uuid, player_season text, status text not null);
create table public.womens_team_reviews (
 id uuid primary key default gen_random_uuid(), author_id uuid not null, womens_team_id uuid not null, status text not null);
alter table public.reviews enable row level security;
alter table public.womens_team_reviews enable row level security;
grant select, insert, update on public.reviews, public.womens_team_reviews to authenticated;
create policy legacy_reviews_insert on public.reviews for insert to authenticated with check (true);
create policy "womens reviews paid verified player insert" on public.womens_team_reviews for insert to authenticated with check (false);
create policy "womens reviews paid verified player insert guard" on public.womens_team_reviews as restrictive for insert to authenticated with check (false);
create policy fixture_read on public.reviews for select to authenticated using (author_id=auth.uid());
create policy fixture_update on public.reviews for update to authenticated using (author_id=auth.uid()) with check (author_id=auth.uid());
create policy fixture_read on public.womens_team_reviews for select to authenticated using (author_id=auth.uid());
create policy fixture_update on public.womens_team_reviews for update to authenticated using (author_id=auth.uid()) with check (author_id=auth.uid());
-- Existing legacy rows survive without inventing a verified season.
insert into public.womens_team_reviews(author_id,womens_team_id,status)
 values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','approved');
\i supabase/candidates/build16_player_review_season_guard_review_only.sql
update public.player_team_season_claims set verification_status='verified' where season_start_year=2023;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('fixture.paid','yes',false);
insert into public.reviews(author_id,team_id,player_season,status)
 values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2023-2024','pending');
insert into public.womens_team_reviews(author_id,womens_team_id,player_season,status)
 values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','2023-2024','pending');
do $$ begin
 if (select count(*) from public.womens_team_reviews where player_season is null and status='approved')<>1 then raise exception 'legacy history lost'; end if;
 begin
 insert into public.reviews(author_id,team_id,player_season,status)
 values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2022-2023','pending');
 raise exception 'pending claim accepted'; exception when insufficient_privilege then null; end;
 begin
 insert into public.reviews(author_id,team_id,player_season,status)
 values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2023-24','pending');
 raise exception 'noncanonical season accepted'; exception when insufficient_privilege then null; end;
 begin
 insert into public.reviews(author_id,team_id,player_season,status)
 values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2023-2024','pending');
 raise exception 'duplicate review accepted'; exception when unique_violation then null; end;
 begin
 insert into public.womens_team_reviews(author_id,womens_team_id,player_season,status)
 values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','2022-2023','pending');
 raise exception 'unverified womens season accepted'; exception when insufficient_privilege then null; end;
 begin
 insert into public.womens_team_reviews(author_id,womens_team_id,player_season,status)
 values ('11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','2023-2024','pending');
 raise exception 'duplicate womens review accepted'; exception when unique_violation then null; end;
 begin
 update public.reviews set player_season='2022-2023';
 raise exception 'review season rewritten'; exception when insufficient_privilege then null; end;
 begin
 update public.womens_team_reviews set player_season='2022-2023' where status='pending';
 raise exception 'womens review season rewritten'; exception when insufficient_privilege then null; end;
 perform set_config('fixture.paid','no',false);
 begin
 insert into public.reviews(author_id,team_id,player_season,status)
 values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2023-2024','pending');
 raise exception 'unpaid review accepted'; exception when insufficient_privilege then null; end;
 perform set_config('fixture.paid','yes',false);
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
 begin
 insert into public.reviews(author_id,team_id,player_season,status)
 values ('22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2023-2024','pending');
 raise exception 'other player claim accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;

\i supabase/candidates/build16_historical_club_seasons_review_only.sql
begin;
insert into public.historical_club_seasons(id,team_id,season_start_year,season_end_year,historical_name,historical_league,historical_division,historical_country,club_state)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2022,2023,'Old Club Name','Original League','First','Example','renamed'),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2023,2024,'New Club Name','Lower League','Second','Example','archived');
insert into public.historical_club_provenance(snapshot_id,verified_by,source_reference)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','11111111-1111-1111-1111-111111111111','fixture roster'),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','11111111-1111-1111-1111-111111111111','fixture league archive');
commit;
do $$ begin
 begin
 delete from public.teams where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 raise exception 'historical club deletion allowed'; exception when foreign_key_violation then null; end;
 begin
 insert into public.historical_club_seasons(womens_team_id,season_start_year,season_end_year,historical_name,historical_league,historical_country,club_state)
 values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',2022,2023,'Unverified club','Fixture','Example','unknown');
 set constraints historical_club_provenance_required immediate;
 raise exception 'unsourced historical snapshot accepted'; exception when foreign_key_violation then null; end;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into public.historical_club_requests(player_id,historical_name,country,league_name,division,basketball_type,season_start_year,season_end_year)
values ('11111111-1111-1111-1111-111111111111','Missing former team','Example','Former League','First','mens',2020,2021);
do $$ begin
 if (select count(*) from public.historical_club_seasons where team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')<>2 then raise exception 'historical seasons not preserved'; end if;
 if (select count(*) from public.historical_club_requests where status='pending')<>1 then raise exception 'request not pending'; end if;
 begin
 update public.historical_club_requests set status='resolved',resolved_snapshot_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
 raise exception 'self resolution allowed'; exception when insufficient_privilege then null; end;
 begin
 update public.historical_club_seasons set historical_name='Forged';
 raise exception 'client altered historical identity'; exception when insufficient_privilege then null; end;
 if has_table_privilege('authenticated','public.historical_club_provenance','SELECT') then raise exception 'private source access granted'; end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ begin
 if exists(select 1 from public.historical_club_requests) then raise exception 'private historical request leaked'; end if;
end $$;
reset role;
set role anon;
do $$ begin
 if (select count(*) from public.historical_club_seasons)<>2 then raise exception 'archive not searchable'; end if;
 if has_table_privilege('anon','public.historical_club_requests','SELECT') then raise exception 'anon request access'; end if;
end $$;
reset role;
