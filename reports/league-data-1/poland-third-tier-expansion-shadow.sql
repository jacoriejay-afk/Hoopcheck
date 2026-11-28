-- PZKosz official 2026-27 licensing roster of 64 clubs:
-- https://rozgrywki.pzkosz.pl/liga/16/aktualnosci/n/69908/komisja-licencyjna-pzkosz-zakonczyla-prace.html
-- Exact normalized full-country identity comparison (including inactive records) found 17 existing
-- third-tier IDs, 47 missing names; preserve distinct reserve squads (II) rather than merge with seniors.
-- Run after poland-lower-divisions-shadow-correction.sql, in the same temporary projection only.
do $poland_64$
declare lid constant uuid := 'a1f12027-752d-5d2f-a6c1-000000000002'; c record;
begin
 if not exists(select 1 from pg_temp.ld1_leagues where id=lid and name='Polish Second League Men' and country='Poland' and basketball_type='mens' and season='2026-27' and active) then raise exception 'Polish third-tier base missing';end if;
 if (select count(*) from pg_temp.ld1_teams where league_id=lid and active and id in ('9e67289e-6000-44a8-a412-c4790bd72eb7','04942459-745d-45b5-908c-a0b64d8d444c','870d7a3a-fa8e-475b-a936-e13559141f89','e1141e62-e773-4923-896f-29a378516b5a','616707e6-2683-4023-b08d-7c19b10adbbb','d281dd7a-09e8-4bb0-882a-4d8d5dce81e7','c3a1f8a6-31fa-432d-9c2d-48e0bfced842','db9973cb-7ab7-4fad-be03-440b2f39e7fa','76665381-c59b-4243-9b20-ea970601213e','a6836c78-c856-4cc3-92bf-e07cc363476e','b0944bfc-8b25-4d6d-aa2b-afca37b7dcd3','293cff30-11fc-455a-a57c-f25619d283e1','1b7ee318-f300-4ba6-af47-e612d972d325','72897d03-704d-40ab-89f9-9b9eedaa95dc','6ce50846-5c92-4b98-9b92-529fc1c7087f','7e80b56a-8c16-4409-b066-9d965cbac666','0aef64bf-0f67-48d8-aae5-a4febf2b98df'))<>17 then raise exception 'Existing Polish roster changed';end if;
 for c in select * from (values
('a1f12027-752d-5d2f-a6c2-000000000001'::uuid,'BSA AMW Arka Gdynia'),
('a1f12027-752d-5d2f-a6c2-000000000002'::uuid,'Mikstol Tarnovia Tarnowo Podgórne'),
('a1f12027-752d-5d2f-a6c2-000000000003'::uuid,'MKS Sokół Marbo Międzychód'),
('a1f12027-752d-5d2f-a6c2-000000000004'::uuid,'Żak Insta-Serwis Koszalin'),
('a1f12027-752d-5d2f-a6c2-000000000005'::uuid,'SMS PZKosz Władysławowo'),
('a1f12027-752d-5d2f-a6c2-000000000006'::uuid,'Akademia Gortata Gdańsk'),
('a1f12027-752d-5d2f-a6c2-000000000007'::uuid,'Energa Trefl II Sopot'),
('a1f12027-752d-5d2f-a6c2-000000000008'::uuid,'TKM Włocławek'),
('a1f12027-752d-5d2f-a6c2-000000000009'::uuid,'Basket 2010 Kruszwica'),
('a1f12027-752d-5d2f-a6c2-000000000010'::uuid,'Gremi Gdańsk'),
('a1f12027-752d-5d2f-a6c2-000000000011'::uuid,'Świecki Klub Koszykówki'),
('a1f12027-752d-5d2f-a6c2-000000000012'::uuid,'Sokół Grupa Avista Ostrów Maz.'),
('a1f12027-752d-5d2f-a6c2-000000000013'::uuid,'Rysie Sochaczew'),
('a1f12027-752d-5d2f-a6c2-000000000014'::uuid,'Dziki II Warszawa'),
('a1f12027-752d-5d2f-a6c2-000000000015'::uuid,'ŁKS II Politechnika Łódzka'),
('a1f12027-752d-5d2f-a6c2-000000000016'::uuid,'AZS AWF Warszawa'),
('a1f12027-752d-5d2f-a6c2-000000000017'::uuid,'PKK 99 Pabianice'),
('a1f12027-752d-5d2f-a6c2-000000000018'::uuid,'KS Księżak Łowicz'),
('a1f12027-752d-5d2f-a6c2-000000000019'::uuid,'Lublinianka KUL Basketball'),
('a1f12027-752d-5d2f-a6c2-000000000020'::uuid,'TSK Roś Pisz'),
('a1f12027-752d-5d2f-a6c2-000000000021'::uuid,'Żubry Abakus Okna Białystok'),
('a1f12027-752d-5d2f-a6c2-000000000022'::uuid,'AZS Politechnika Warszawska'),
('a1f12027-752d-5d2f-a6c2-000000000023'::uuid,'pempaVita Resovia Rzeszów'),
('a1f12027-752d-5d2f-a6c2-000000000024'::uuid,'GMS KKS Tarnowskie Góry'),
('a1f12027-752d-5d2f-a6c2-000000000025'::uuid,'Zagłębie Sosnowiec'),
('a1f12027-752d-5d2f-a6c2-000000000026'::uuid,'MKS II Dąbrowa Górnicza'),
('a1f12027-752d-5d2f-a6c2-000000000027'::uuid,'MKKS Rybnik'),
('a1f12027-752d-5d2f-a6c2-000000000028'::uuid,'Wisła Veneo Kraków'),
('a1f12027-752d-5d2f-a6c2-000000000029'::uuid,'Miners Katowice'),
('a1f12027-752d-5d2f-a6c2-000000000030'::uuid,'ZKS Stal Stalowa Wola'),
('a1f12027-752d-5d2f-a6c2-000000000031'::uuid,'UKS Regis Wieliczka'),
('a1f12027-752d-5d2f-a6c2-000000000032'::uuid,'MKKS Siarka Tarnobrzeg'),
('a1f12027-752d-5d2f-a6c2-000000000033'::uuid,'GTK II Gliwice'),
('a1f12027-752d-5d2f-a6c2-000000000034'::uuid,'EIG Kangoo Basket Gorzów'),
('a1f12027-752d-5d2f-a6c2-000000000035'::uuid,'Kosz Ciepłomax Kompaktowy Pleszew'),
('a1f12027-752d-5d2f-a6c2-000000000036'::uuid,'Pogoń Prudnik'),
('a1f12027-752d-5d2f-a6c2-000000000037'::uuid,'KS Sudety Jelenia Góra'),
('a1f12027-752d-5d2f-a6c2-000000000038'::uuid,'Roben Gimbasket Wrocław'),
('a1f12027-752d-5d2f-a6c2-000000000039'::uuid,'U&R Calor Twierdza Kłodzko'),
('a1f12027-752d-5d2f-a6c2-000000000040'::uuid,'Pyra AZS Szkoła Gortata Poznań'),
('a1f12027-752d-5d2f-a6c2-000000000041'::uuid,'Dijo Polkąty Maximus Kąty Wrocł.'),
('a1f12027-752d-5d2f-a6c2-000000000042'::uuid,'Enea Basket II Poznań'),
('a1f12027-752d-5d2f-a6c2-000000000043'::uuid,'SKM Zastal Zielona Góra'),
('a1f12027-752d-5d2f-a6c2-000000000044'::uuid,'Exact Forestall Śląsk Wrocław'),
('a1f12027-752d-5d2f-a6c2-000000000045'::uuid,'WKK II Active Hotel Wrocław'),
('a1f12027-752d-5d2f-a6c2-000000000046'::uuid,'AK Orły Wrocław'),
('a1f12027-752d-5d2f-a6c2-000000000047'::uuid,'DGP Basket Legnica')
 ) x(id,name) loop
 if exists(select 1 from pg_temp.ld1_teams where id=c.id and (name is distinct from c.name or country is distinct from 'Poland' or basketball_type is distinct from 'mens' or league_id is distinct from lid or league_name is distinct from 'Polish Second League Men' or active is not true))
 or exists(select 1 from pg_temp.ld1_teams where id<>c.id and country='Poland' and basketball_type='mens' and lower(regexp_replace(name,'[^[:alnum:]]','','g'))=lower(regexp_replace(c.name,'[^[:alnum:]]','','g')))
 or exists(select 1 from pg_temp.ld1_legacy_teams where id=c.id)
 or exists(select 1 from pg_temp.ld1_memberships where team_id=c.id and league_id=lid and season='2026-27' and active is not true)
 then raise exception 'Polish third-tier club identity conflict: %',c.name;end if;
 insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values(c.id,c.name,'Poland',lid,'Polish Second League Men','mens',true) on conflict(id) do nothing;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active) values(gen_random_uuid(),c.id,lid,'2026-27',true) on conflict(team_id,league_id,season) do nothing;
 end loop;
 if (select count(*) from pg_temp.ld1_teams where league_id=lid and active)<>64 or (select count(*) from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and active)<>64 then raise exception 'Polish third tier must contain exactly 64 clubs';end if;
end $poland_64$;
