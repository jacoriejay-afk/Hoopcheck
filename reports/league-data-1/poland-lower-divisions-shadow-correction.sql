-- PZKosz official 2026-27 licence list: https://rozgrywki.pzkosz.pl/liga/16/aktualnosci/n/69908/komisja-licencyjna-pzkosz-zakonczyla-prace.html
-- Women: complete 13-team list. Men: 17 verified existing records of 64 licensed teams;
-- other 47 men's identities require separate reconciliation. Temporary projection only.
do $polish_lower$
declare c record; l record;
begin
 for l in select * from (values ('a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',13),('a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',17)) x(id,name,side,n) loop
 if exists(select 1 from pg_temp.ld1_leagues where id=l.id and (name is distinct from l.name or country is distinct from 'Poland' or season is distinct from '2026-27' or basketball_type is distinct from l.side or active is not true)) or exists(select 1 from pg_temp.ld1_leagues where id<>l.id and country='Poland' and basketball_type=l.side and lower(name)=lower(l.name)) then raise exception 'Polish lower league collision';end if;
 insert into pg_temp.ld1_leagues(id,name,country,season,basketball_type,active) values(l.id,l.name,'Poland','2026-27',l.side,true) on conflict(id) do nothing;
 end loop;
 if exists(select 1 from pg_temp.ld1_legacy_leagues where id='a1f12027-752d-5d2f-a6c1-000000000001' and (name is distinct from 'Polish First League Women' or country is distinct from 'Poland' or active is not true)) then raise exception 'Polish legacy league collision';end if;
 insert into pg_temp.ld1_legacy_leagues(id,name,country,active) values('a1f12027-752d-5d2f-a6c1-000000000001','Polish First League Women','Poland',true) on conflict(id) do nothing;
 for c in select * from (values
('3750dd83-6228-4468-9e55-46c2a5a98795'::uuid,'Lider Swarzędz','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('4e1d649c-df60-4ce0-8ea3-bab7ca6defab'::uuid,'ŁKS KK Łódź','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('62ee9e82-1c67-47c8-ae7a-63d2b18e1c75'::uuid,'Korona 1919 AZS Kraków','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('7df9bbac-1088-4b2d-ab4e-b349bf90605d'::uuid,'KS Ostrovia Ostrów Wielkopolski Women','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('85151402-7bad-4d0a-be5d-9e0e2908fb40'::uuid,'Tęcza Leszno','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('95f5e3ab-a9bd-4ace-84e1-f093db601464'::uuid,'RMKS Xbest Rybnik','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('9c549b7e-38cf-4831-908a-8206b065499a'::uuid,'SMS PZKosz Łomianki','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('9d955082-b51a-4cbd-bbaa-0bdd84155a1e'::uuid,'Basket 4Ever AZS UMed Ksawerów','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('be18f30e-17c4-46fc-ab36-da2b86e1cab3'::uuid,'MUKS Poznań','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('bea488d8-c889-4d13-b154-3ba4f3351f5a'::uuid,'Nautiqus AZS Uniwersytet Gdański','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('f3c07d68-2fd2-426e-99ee-ab62b26e5147'::uuid,'Pantery Łańcut','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('f7c4fca3-cf97-438e-abaa-2093d0dc2ed2'::uuid,'AZS UW Warszawa Women','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',true),
('04942459-745d-45b5-908c-a0b64d8d444c'::uuid,'Port Gdynia GAK','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('0aef64bf-0f67-48d8-aae5-a4febf2b98df'::uuid,'MKS Smyk Prudnik','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('1b7ee318-f300-4ba6-af47-e612d972d325'::uuid,'KS Cracovia 1906 Kraków','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('293cff30-11fc-455a-a57c-f25619d283e1'::uuid,'AZS AGH Kraków','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('616707e6-2683-4023-b08d-7c19b10adbbb'::uuid,'Sklep Polski MKK Gniezno','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('6ce50846-5c92-4b98-9b92-529fc1c7087f'::uuid,'UJK Kielce','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('72897d03-704d-40ab-89f9-9b9eedaa95dc'::uuid,'AZS Jarosław','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('76665381-c59b-4243-9b20-ea970601213e'::uuid,'RJ House Legion Legionowo','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('7e80b56a-8c16-4409-b066-9d965cbac666'::uuid,'PGE GiEK Turów Zgorzelec','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('870d7a3a-fa8e-475b-a936-e13559141f89'::uuid,'Energa Basketball Elbląg','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('9e67289e-6000-44a8-a412-c4790bd72eb7'::uuid,'AZS UMK Transbruk Toruń','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('a6836c78-c856-4cc3-92bf-e07cc363476e'::uuid,'Znicz Basket Pruszków','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('b0944bfc-8b25-4d6d-aa2b-afca37b7dcd3'::uuid,'Basket Hills Bielsko-Biała','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('c3a1f8a6-31fa-432d-9c2d-48e0bfced842'::uuid,'HydroTruck Radom','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('d281dd7a-09e8-4bb0-882a-4d8d5dce81e7'::uuid,'Profbud Legia II Warszawa','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('db9973cb-7ab7-4fad-be03-440b2f39e7fa'::uuid,'KKS Tur Bielsk Podlaski','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('e1141e62-e773-4923-896f-29a378516b5a'::uuid,'KS BNG Kutno','a1f12027-752d-5d2f-a6c1-000000000002'::uuid,'Polish Second League Men','mens',true),
('a1f12027-752d-5d2f-a6c1-000000000003'::uuid,'Sparta Ziębice','a1f12027-752d-5d2f-a6c1-000000000001'::uuid,'Polish First League Women','womens',false)
 ) x(id,name,lid,label,side,existing) loop
 if c.existing then
 if not exists(select 1 from pg_temp.ld1_teams where id=c.id and name=c.name and country='Poland' and basketball_type=c.side and active and league_name=c.label and (league_id is null or league_id=c.lid)) then raise exception 'Polish club identity changed: %',c.id;end if;
 update pg_temp.ld1_teams set league_id=c.lid where id=c.id and league_id is null;
 else
 if exists(select 1 from pg_temp.ld1_teams where id=c.id and (name is distinct from c.name or country is distinct from 'Poland' or basketball_type is distinct from c.side or league_id is distinct from c.lid or league_name is distinct from c.label or active is not true)) or exists(select 1 from pg_temp.ld1_teams where id<>c.id and country='Poland' and basketball_type='womens' and (name ilike '%sparta%' or name ilike '%ziębic%' or name ilike '%ziebic%')) then raise exception 'Sparta identity collision';end if;
 insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values(c.id,c.name,'Poland',c.lid,c.label,c.side,true) on conflict(id) do nothing;
 end if;
 if c.side='womens' then
 if exists(select 1 from pg_temp.ld1_legacy_teams where id=c.id and (name is distinct from c.name or country is distinct from 'Poland' or league_id is distinct from c.lid or league_name is distinct from c.label or active is not true)) or exists(select 1 from pg_temp.ld1_legacy_teams where id<>c.id and country='Poland' and lower(regexp_replace(name,'[^[:alnum:]]','','g'))=lower(regexp_replace(c.name,'[^[:alnum:]]','','g'))) then raise exception 'Polish legacy club collision';end if;
 insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active) values(c.id,c.name,'Poland',c.lid,c.label,true) on conflict(id) do nothing;
 end if;
 if exists(select 1 from pg_temp.ld1_memberships where team_id=c.id and league_id=c.lid and season='2026-27' and active is not true) then raise exception 'Polish inactive membership conflict';end if;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active) values(gen_random_uuid(),c.id,c.lid,'2026-27',true) on conflict(team_id,league_id,season) do nothing;
 end loop;
 for l in select * from (values ('a1f12027-752d-5d2f-a6c1-000000000001'::uuid,13),('a1f12027-752d-5d2f-a6c1-000000000002'::uuid,17)) x(id,n) loop
 if (select count(*) from pg_temp.ld1_teams where league_id=l.id and active)<>l.n or (select count(*) from pg_temp.ld1_memberships where league_id=l.id and season='2026-27' and active)<>l.n then raise exception 'Polish lower division subset mismatch';end if;
 end loop;
 if (select count(*) from pg_temp.ld1_legacy_teams where league_id='a1f12027-752d-5d2f-a6c1-000000000001' and active)<>13 then raise exception 'Polish women mirror mismatch';end if;
end $polish_lower$;
