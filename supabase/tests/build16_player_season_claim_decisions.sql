\set ON_ERROR_STOP on
-- Disposable synthetic schema only.
create schema auth;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin bypassrls;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
create schema hoopcheck_security;
create function hoopcheck_security.is_approved_owner() returns boolean language sql stable as $$ select auth.uid()='11111111-1111-1111-1111-111111111111'::uuid $$;
create table public.admin_roles(user_id uuid,role text);
create table public.profiles(id uuid primary key, account_type text not null);
create table public.teams(id uuid primary key);
create table public.womens_teams(id uuid primary key);
grant select on public.profiles to authenticated;
insert into public.profiles values
 ('11111111-1111-1111-1111-111111111111','player'),
 ('22222222-2222-2222-2222-222222222222','player'),
 ('33333333-3333-3333-3333-333333333333','player'),
 ('44444444-4444-4444-4444-444444444444','player');
insert into public.admin_roles values
 ('11111111-1111-1111-1111-111111111111','admin'),
 ('33333333-3333-3333-3333-333333333333','admin'),
 ('44444444-4444-4444-4444-444444444444','moderator');
insert into public.teams values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
\i supabase/candidates/build16_player_team_season_claims_review_only.sql
\i supabase/candidates/build16_player_season_claim_decisions_review_only.sql
insert into public.player_team_season_claims(id,player_id,team_id,season_start_year,season_end_year) values
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2022,2023),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2022,2023);
set role authenticated;
do $$
declare actor uuid;
begin
 foreach actor in array array['22222222-2222-2222-2222-222222222222'::uuid,'33333333-3333-3333-3333-333333333333'::uuid,'44444444-4444-4444-4444-444444444444'::uuid] loop
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin
 perform public.decide_player_season_claim('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','verified','Fixture','contract','cccccccc-cccc-cccc-cccc-cccccccccccc');
 raise exception 'unauthorized actor approved claim'; exception when insufficient_privilege then null; end;
 end loop;
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 begin
 perform public.decide_player_season_claim('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2','verified','Fixture','contract','cccccccc-cccc-cccc-cccc-cccccccccccc');
 raise exception 'owner self-approved'; exception when insufficient_privilege then null; end;
 begin
 perform public.decide_player_season_claim('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','verified','Fixture');
 raise exception 'approval without evidence reference'; exception when invalid_parameter_value then null; end;
 if public.decide_player_season_claim('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','verified','Fixture','official_roster','cccccccc-cccc-cccc-cccc-cccccccccccc') <> 'verified' then raise exception 'owner approval failed'; end if;
 begin
 perform public.decide_player_season_claim('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','verified','Fixture','official_roster','cccccccc-cccc-cccc-cccc-cccccccccccc');
 raise exception 'repeat decision accepted'; exception when invalid_parameter_value then null; end;
 if public.decide_player_season_claim('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','revoked','Fixture correction') <> 'revoked' then raise exception 'revocation failed'; end if;
 if has_table_privilege('authenticated','public.player_season_claim_decisions','SELECT') then raise exception 'private audit visible'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.decide_player_season_claim(uuid,text,text,text,uuid)','EXECUTE') then raise exception 'anon execution'; end if;
 if (select count(*) from public.player_season_claim_decisions)<>2 then raise exception 'audit count incorrect'; end if;
 if (select verification_status from public.player_team_season_claims where id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1') <> 'revoked' then raise exception 'claim state incorrect'; end if;
end $$;
