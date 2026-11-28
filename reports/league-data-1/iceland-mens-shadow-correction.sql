-- Current Iceland men's roster verified against KKÍ 2026-27 competition fixtures:
-- https://kki.is/motamal/leikir-og-urslit/motayfirlit/Deildir-flokkar?league_id=190
-- Temporary directory projection only. Retain old league ID/name, all aliases,
-- international affiliations, and historical memberships; no production writes.
do $iceland_men$
declare
 lid constant uuid := '5114c521-cf4b-4ed4-a0f1-b9f0a8275597';
 missing_id constant uuid := 'cc1ce627-72b4-51a3-8bc0-000000000001';
 ids uuid[] := array['381b4209-979e-43ff-aa25-364b22ffbc50','3b2695bd-7f5f-4bae-a9a5-711cf0447015','d2e3e86c-0a4b-4780-b8b9-c6cbb20fc16b','a1403bea-5d4f-481a-a791-07c42e3dc053','5da1b19f-74e2-4883-adcc-d14118d76285','ee785f83-e643-4aff-a94f-f756ccfbc9a9','5080a2d6-f622-4931-a445-34f692100b09','1c7cccd2-2c49-46fa-a7ac-79f2080ec6a7','34c07473-784a-436c-8376-ac327a523aa6','2b042c5d-370b-4183-91d1-cb8eb2fcf379','bf2c8066-c29c-4ef9-bb3a-246ca378ee93']::uuid[];
 names text[] := array['Álftanes','Ármann','Grindavík','ÍR','Keflavík','KR','Njarðvík','Sindri','Stjarnan','Tindastóll','Valur'];
 i int;
begin
 if not exists(select 1 from pg_temp.ld1_leagues where id=lid and name='Úrvalsdeild karla' and country='Iceland' and basketball_type='mens' and active and (season is null or season='2026-27'))
 or exists(select 1 from pg_temp.ld1_leagues where id<>lid and country='Iceland' and basketball_type='mens' and lower(trim(name)) in ('úrvalsdeild karla','bónus deild karla','bonus deild karla'))
 or exists(select 1 from pg_temp.ld1_teams where id=missing_id and (name is distinct from 'Höttur' or country is distinct from 'Iceland' or basketball_type is distinct from 'mens' or league_id is distinct from lid or active is not true))
 or exists(select 1 from pg_temp.ld1_teams where id<>missing_id and country='Iceland' and basketball_type='mens' and lower(trim(name)) in ('höttur','hottur','hö ttur','hö ttur egilsstaðir','höttur egilsstaðir','hottur egilsstadir'))
 or exists(select 1 from pg_temp.ld1_teams where league_id=lid and active and id<>all(ids||array[missing_id]))
 or exists(select 1 from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and (team_id<>all(ids||array[missing_id]) or active is not true))
 then raise exception 'Iceland men roster identity changed; manual review required';end if;
 for i in 1..11 loop
  if not exists(select 1 from pg_temp.ld1_teams where id=ids[i] and name=names[i] and country='Iceland' and basketball_type='mens' and league_id=lid and active)
  then raise exception 'Iceland existing club identity changed';end if;
 end loop;
 update pg_temp.ld1_leagues set season='2026-27' where id=lid and season is null;
 insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active)
 values(missing_id,'Höttur','Iceland',lid,'Úrvalsdeild karla','mens',true) on conflict(id) do nothing;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
 select gen_random_uuid(),id,lid,'2026-27',true from unnest(ids||array[missing_id]) id on conflict(team_id,league_id,season) do nothing;
 if (select count(*) from pg_temp.ld1_teams where league_id=lid and active)<>12
 or (select count(*) from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and active)<>12
 then raise exception 'Iceland official twelve-club roster check failed';end if;
end $iceland_men$;
