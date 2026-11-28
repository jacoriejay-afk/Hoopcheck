-- Isolated directory projection only; no production migration.
-- KKÍ September 25 participant list and September 29 opening fixtures:
-- https://www.kki.is/frettir/frett/2026/09/25/Spa-formanna-fyrirlida-og-thjalfara-Bonusdeildar-kvenna/
-- https://kki.is/frettir/frett/2026/09/29/Bonusdeild-kvenna-hefst-i-kvold-med-thremur-leikjum/
-- Requires session-local shadow tables; does not reproduce actual notification/fan-group triggers.
do $ice$
declare
 league constant uuid := 'c1102127-379f-5d5a-8221-f6eaf93c7c28';
 club_names text[] := array['Njarðvík','Grindavík','KR','Haukar','Tindastóll','Keflavík','Valur','Stjarnan','Ármann','Fjölnir'];
 club text; club_id uuid; idx int:=0;
begin
 if exists(select 1 from pg_temp.ld1_leagues where country='Iceland' and basketball_type='womens' and id<>league)
 or exists(select 1 from pg_temp.ld1_teams where country='Iceland' and basketball_type='womens' and id not in (select ('c1102127-379f-5d5a-8221-'||lpad(i::text,12,'0'))::uuid from generate_series(1,10) i))
 or exists(select 1 from pg_temp.ld1_leagues where id=league and (name is distinct from 'Bónus deild kvenna' or country is distinct from 'Iceland' or season is distinct from '2026-27' or basketball_type is distinct from 'womens'))
 then raise exception 'Iceland women identity scope changed; review required'; end if;
 insert into pg_temp.ld1_leagues(id,name,country,season,basketball_type,active)
 values(league,'Bónus deild kvenna','Iceland','2026-27','womens',true) on conflict(id) do nothing;
 foreach club in array club_names loop
  idx:=idx+1;club_id:=('c1102127-379f-5d5a-8221-'||lpad(idx::text,12,'0'))::uuid;
  if exists(select 1 from pg_temp.ld1_teams where id=club_id and (name is distinct from club or country is distinct from 'Iceland' or basketball_type is distinct from 'womens' or league_id is distinct from league))
  then raise exception 'Iceland women proposed team identity collision';end if;
  insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active)
  values(club_id,club,'Iceland',league,'Bónus deild kvenna','womens',true) on conflict(id) do nothing;
  insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
  values(gen_random_uuid(),club_id,league,'2026-27',true)
  on conflict(team_id,league_id,season) do update set active=excluded.active;
 end loop;
 if (select count(*) from pg_temp.ld1_teams where league_id=league and country='Iceland' and basketball_type='womens' and active is true)<>10
 or (select count(*) from pg_temp.ld1_memberships where league_id=league and season='2026-27' and active is true)<>10
 then raise exception 'Iceland women coverage mismatch';end if;
end $ice$;
