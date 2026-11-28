-- Belarus Basketball Federation BETERA championship Group A/B standings:
-- https://belarus.russiabasket.ru/competitions
-- 2026-27 fixtures corroboration: https://by.tribuna.com/basketball/tournament/belarus-basketball/schedule/
-- Historical Gomel and Brest names: https://ru.wikipedia.org/wiki/Чемпионат_Беларуси_по_баскетболу
-- Seven existing IDs mapped, six missing reserve/academy clubs proposed. Grodno-93 GrSU identity
-- remains unresolved against Prinemanye Grodno. BC Minsk alias and BC Barsy primary retained for review.
-- Do not count unverified primary links as verified season memberships. Temporary projection only.
do $belarus$
declare lid constant uuid := '51b5eb75-e46d-4029-8803-a3eea5088637'; c record; clubs uuid[] := array['091758fa-d86b-4f79-a072-afeadc621af0','1691922a-6ae5-4986-aa9f-3a1879060e45','30f6f6fe-5549-43ed-9886-c731b2530113','4a8edaa9-d51f-4d71-babe-3e57fcc4ef2a','557cdfdb-45eb-4a3a-bd6c-fd2714adc4a6','c6cc1fc0-40b0-43cb-a450-28d92a8e3472','d095ee76-a2a6-4319-aae4-feab8b1cc360','b3b12027-612f-5c8b-9a5d-000000000001','b3b12027-612f-5c8b-9a5d-000000000002','b3b12027-612f-5c8b-9a5d-000000000003','b3b12027-612f-5c8b-9a5d-000000000004','b3b12027-612f-5c8b-9a5d-000000000005','b3b12027-612f-5c8b-9a5d-000000000006']::uuid[];
begin
 if not exists(select 1 from pg_temp.ld1_leagues where id=lid and name='Premier League' and country='Belarus' and basketball_type='mens' and season='2026-27' and active)
 or exists(select 1 from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and (team_id<>all(clubs) or active is not true)) then raise exception 'Belarus league or season changed';end if;
 for c in select * from (values
('091758fa-d86b-4f79-a072-afeadc621af0'::uuid,'GOCOR-Soj Gomel','Belarusian Premier League'),
('1691922a-6ae5-4986-aa9f-3a1879060e45'::uuid,'BC Tsmoki-Minsk','Premier League'),
('30f6f6fe-5549-43ed-9886-c731b2530113'::uuid,'RCOP-SDUSHOR','Belarusian Premier League'),
('4a8edaa9-d51f-4d71-babe-3e57fcc4ef2a'::uuid,'Borisfen Mogilev','Belarusian Premier League'),
('557cdfdb-45eb-4a3a-bd6c-fd2714adc4a6'::uuid,'BK Grodno-93','Premier League'),
('c6cc1fc0-40b0-43cb-a450-28d92a8e3472'::uuid,'Brest Region','Belarusian Premier League'),
('d095ee76-a2a6-4319-aae4-feab8b1cc360'::uuid,'Rubon Vitebsk','Belarusian Premier League')
 ) x(id,name,old_label) loop
 if not exists(select 1 from pg_temp.ld1_teams where id=c.id and name=c.name and country='Belarus' and basketball_type='mens' and active and league_name=c.old_label and (league_id is null or league_id=lid)) then raise exception 'Belarus club changed: %',c.name;end if;
 update pg_temp.ld1_teams set league_id=lid where id=c.id and league_id is null;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active) values(gen_random_uuid(),c.id,lid,'2026-27',true) on conflict(team_id,league_id,season) do nothing;
 end loop;
 for c in select * from (values
('b3b12027-612f-5c8b-9a5d-000000000001'::uuid,'Minsk Youth'),
('b3b12027-612f-5c8b-9a5d-000000000002'::uuid,'Borisfen Mogilev Youth'),
('b3b12027-612f-5c8b-9a5d-000000000003'::uuid,'Rubon Vitebsk Youth'),
('b3b12027-612f-5c8b-9a5d-000000000004'::uuid,'Gomel Lynxes Youth'),
('b3b12027-612f-5c8b-9a5d-000000000005'::uuid,'SDUSHOR Victoria Brest'),
('b3b12027-612f-5c8b-9a5d-000000000006'::uuid,'RGUOR Minsk')
 ) x(id,name) loop
 if exists(select 1 from pg_temp.ld1_teams where id=c.id and (name is distinct from c.name or country is distinct from 'Belarus' or basketball_type is distinct from 'mens' or league_id is distinct from lid or league_name is distinct from 'Premier League' or active is not true))
 or exists(select 1 from pg_temp.ld1_teams where id<>c.id and country='Belarus' and basketball_type='mens' and lower(regexp_replace(name,'[^[:alnum:]]','','g'))=lower(regexp_replace(c.name,'[^[:alnum:]]','','g'))) then raise exception 'Belarus new identity collision: %',c.name;end if;
 insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values(c.id,c.name,'Belarus',lid,'Premier League','mens',true) on conflict(id) do nothing;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active) values(gen_random_uuid(),c.id,lid,'2026-27',true) on conflict(team_id,league_id,season) do nothing;
 end loop;
 if (select count(*) from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and active)<>13 then raise exception 'Belarus verified membership count mismatch';end if;
end $belarus$;
