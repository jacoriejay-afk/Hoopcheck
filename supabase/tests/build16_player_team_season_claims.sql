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
