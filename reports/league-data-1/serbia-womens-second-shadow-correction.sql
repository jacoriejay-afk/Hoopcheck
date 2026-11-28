-- 2026-27 nine-club list: https://wbasket.org/druga-zenska-liga-srbije-sa-9-klubova/
-- Federation-attributed fixtures: https://sportsevents24.com/tournament/155258/basketball-serbia-kss-basketball-2026-2027-285?view=table
-- Official KSS competition page: https://lige.kss.rs/seniorke/2-zenska-liga-srbije/
-- Temporary projection only; preserve existing team identities and all legacy records.
do $serbia_second$
declare lid constant uuid := '25d31a22-7238-5b7d-9b5f-000000000001'; clubs uuid[] := array['11446cbe-3226-45eb-b2fb-9db9206225dd','11ab531e-9f30-45b6-8686-9f94e993e4a3','1f6ce597-dcdf-4ae0-b8c0-e86d3d7b21ce','455240aa-8737-45d0-9d43-eea4ae694764','516b41df-c6e6-4b47-8bf5-649937d72482','54e65502-9021-4a6f-a66e-64de06b9f540','85e260c8-7dd9-4e24-ad3e-2a11d4ef91f3','a7bb5fbf-7a35-46fc-b983-be53e3469318','cd60f9f3-ed91-4d94-a750-a201b8fa1585']::uuid[]; c record;
begin
 if exists(select 1 from pg_temp.ld1_leagues where id=lid and (name is distinct from 'Druga ženska liga Srbije' or country is distinct from 'Serbia' or season is distinct from '2026-27' or basketball_type is distinct from 'womens' or active is not true))
 or exists(select 1 from pg_temp.ld1_leagues where id<>lid and country='Serbia' and basketball_type='womens' and (name ilike '%druga%' or name ilike '%second%' or name ilike '%2. žls%'))
 or exists(select 1 from pg_temp.ld1_legacy_leagues where id=lid and (name is distinct from 'Druga ženska liga Srbije' or country is distinct from 'Serbia' or active is not true))
 or exists(select 1 from pg_temp.ld1_legacy_leagues where id<>lid and country='Serbia' and (name ilike '%druga%' or name ilike '%second%' or name ilike '%2. žls%'))
 or exists(select 1 from pg_temp.ld1_teams where country='Serbia' and basketball_type='womens' and active and (league_id=lid or league_name='Druga ženska liga Srbije') and id<>all(clubs))
 or exists(select 1 from pg_temp.ld1_legacy_teams where league_id=lid and active and id<>all(clubs))
 or exists(select 1 from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and (team_id<>all(clubs) or active is not true))
 then raise exception 'Serbian second division identity changed';end if;
 insert into pg_temp.ld1_leagues(id,name,country,season,basketball_type,active) values(lid,'Druga ženska liga Srbije','Serbia','2026-27','womens',true) on conflict(id) do nothing;
 insert into pg_temp.ld1_legacy_leagues(id,name,country,active) values(lid,'Druga ženska liga Srbije','Serbia',true) on conflict(id) do nothing;
 for c in select * from (values ('11446cbe-3226-45eb-b2fb-9db9206225dd'::uuid,'SPD Radnički Kragujevac Women'),('11ab531e-9f30-45b6-8686-9f94e993e4a3'::uuid,'Sloga Požega Women'),('1f6ce597-dcdf-4ae0-b8c0-e86d3d7b21ce'::uuid,'Srbobran Women'),('455240aa-8737-45d0-9d43-eea4ae694764'::uuid,'Novi Pazar Women'),('516b41df-c6e6-4b47-8bf5-649937d72482'::uuid,'Plej of Užice Women'),('54e65502-9021-4a6f-a66e-64de06b9f540'::uuid,'Rudar 1903 Women'),('85e260c8-7dd9-4e24-ad3e-2a11d4ef91f3'::uuid,'Karaburma Women'),('a7bb5fbf-7a35-46fc-b983-be53e3469318'::uuid,'Zlatar Nova Varoš Women'),('cd60f9f3-ed91-4d94-a750-a201b8fa1585'::uuid,'Proleter Novi Sad Women')) x(id,name) loop
 if not exists(select 1 from pg_temp.ld1_teams t where t.id=c.id and t.name=c.name and t.country='Serbia' and t.basketball_type='womens' and t.active and t.league_name='Druga ženska liga Srbije' and (t.league_id is null or t.league_id=lid))
 or exists(select 1 from pg_temp.ld1_legacy_teams w where w.id=c.id and (w.name is distinct from c.name or w.country is distinct from 'Serbia' or w.league_id is distinct from lid or w.league_name is distinct from 'Druga ženska liga Srbije' or w.active is not true))
 or exists(select 1 from pg_temp.ld1_legacy_teams w where w.id<>c.id and w.country='Serbia' and lower(regexp_replace(w.name,'[^[:alnum:]]','','g'))=lower(regexp_replace(c.name,'[^[:alnum:]]','','g')))
 then raise exception 'Serbian club identity changed: %',c.id;end if;
 update pg_temp.ld1_teams set league_id=lid where id=c.id and league_id is null;
 insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active) values(c.id,c.name,'Serbia',lid,'Druga ženska liga Srbije',true) on conflict(id) do nothing;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active) values(gen_random_uuid(),c.id,lid,'2026-27',true) on conflict(team_id,league_id,season) do nothing;
 end loop;
 if (select count(*) from pg_temp.ld1_teams where league_id=lid and active)<>9 or (select count(*) from pg_temp.ld1_legacy_teams where league_id=lid and active)<>9 or (select count(*) from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and active)<>9 then raise exception 'Second division roster mismatch';end if;
end $serbia_second$;
