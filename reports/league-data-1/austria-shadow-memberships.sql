-- Austria official 2026-27 standings and current federation previews:
-- https://basketballaustria.at/bsl
-- https://news.basketballaustria.at/News_Detail.aspx?id=249322&menueid=19426
-- https://news.basketballaustria.at/News_Detail.aspx?id=253026&menueid=19426
-- https://news.basketballaustria.at/News_Detail.aspx?id=252594&menueid=19426
-- Preserve existing primary affiliations and IDs, including sponsor aliases.
-- Temporary directory projection only. No public writes.
do $austria$
declare lid uuid; expected_count integer; clubs uuid[];
begin
 lid:='ea2c29f1-229b-478b-9df3-ac25e0ce76e5'; expected_count:=11;
 clubs:=array['1545ed7d-d34d-4d2f-a47a-75ba2118bdbb','1903f0c1-721b-409c-a543-9abf33836ccb','2189926c-b21a-4273-9618-93155a6fd86c','34e83e06-0250-441c-9f86-4d6dd26d1fa8','60e3c61e-e033-4cef-b093-3b4bcbb67eff','625da67d-548e-4510-b7c1-eb26c1800b50','6440fd33-89ef-458d-ad27-5d769abb8885','7256aca8-4789-426c-abe1-7b40a77d0607','c6fa8ee9-5238-49ad-9260-5b72f37b4ea5','cd8d17c5-1711-46b6-807c-fb8797eaf08e','e02748c0-22b9-443c-9eed-dfb2cfe0e8b7']::uuid[];
 if not exists(select 1 from pg_temp.ld1_leagues where id=lid and name='Basketball Superliga' and country='Austria' and season='2026-27' and basketball_type='mens' and active)
 or (select count(*) from pg_temp.ld1_teams where league_id=lid and active)<>expected_count
 or (select count(*) from pg_temp.ld1_teams t join (values ('1545ed7d-d34d-4d2f-a47a-75ba2118bdbb'::uuid,'UNGER STEEL Gunners Oberwart'),('1903f0c1-721b-409c-a543-9abf33836ccb'::uuid,'BK Karbon-X Dukes'),('2189926c-b21a-4273-9618-93155a6fd86c'::uuid,'BC Vienna'),('34e83e06-0250-441c-9f86-4d6dd26d1fa8'::uuid,'Raiffeisen Flyers Wels'),('60e3c61e-e033-4cef-b093-3b4bcbb67eff'::uuid,'HEFTE HELFEN Bulls Kapfenberg'),('625da67d-548e-4510-b7c1-eb26c1800b50'::uuid,'druck.at Traiskirchen Lions'),('6440fd33-89ef-458d-ad27-5d769abb8885'::uuid,'SKN St. Pölten Basketball'),('7256aca8-4789-426c-abe1-7b40a77d0607'::uuid,'Pirlo Kufstein Towers'),('c6fa8ee9-5238-49ad-9260-5b72f37b4ea5'::uuid,'COLDAMARIS BBC Nord Dragonz'),('cd8d17c5-1711-46b6-807c-fb8797eaf08e'::uuid,'Eagles Raiffeisen UBSC Graz'),('e02748c0-22b9-443c-9eed-dfb2cfe0e8b7'::uuid,'Raiffeisen Swans Gmunden')) e(id,name) on t.id=e.id and t.name=e.name where t.league_id=lid and t.country='Austria' and t.basketball_type='mens' and t.active)<>expected_count
 or exists(select 1 from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and (team_id<>all(clubs) or active is not true))
 then raise exception 'Austria official season roster changed; review required';end if;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
 select gen_random_uuid(),id,lid,'2026-27',true from unnest(clubs) id on conflict(team_id,league_id,season) do nothing;
 if (select count(*) from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and active)<>expected_count then raise exception 'Austria season membership count mismatch';end if;
 lid:='551948e7-410a-4cab-b39f-feb5ff10cf6d'; expected_count:=15;
 clubs:=array['0bf96da1-3a1d-4ff0-afbd-d44a2c50ef84','153076a7-7c46-4f00-a4ac-4de2553c80fa','3dcdb610-7969-46f2-bff4-154f859c07c6','6209c6a2-8af4-4377-830b-7e5335f50628','75900f03-087a-4e35-b8c8-1d83ec9f098f','7a1a633b-61ae-4daa-9c44-8146a36ed3c6','90901ff7-6c21-45b2-8870-9b5438ed8618','9218ee90-f7fb-4a18-b274-2098f6aaba63','999f330c-363a-442f-91ee-6b00188b0fa6','a0ed5191-6ed2-44d9-a17d-43134b94177f','b6c81f3a-6f48-4d20-a9b1-665e2f05d85a','ba41323f-a2a3-4a33-8c3c-87f9ba4a3b44','d53c5c05-b59a-4fe6-b844-562c37b011c1','d6651191-c56d-4d60-ac30-cc7b8a5edbfb','e867479f-71a5-4bdd-81d8-35b2da7b1e88']::uuid[];
 if not exists(select 1 from pg_temp.ld1_leagues where id=lid and name='Basketball Zweite Liga' and country='Austria' and season='2026-27' and basketball_type='mens' and active)
 or (select count(*) from pg_temp.ld1_teams where league_id=lid and active)<>expected_count
 or (select count(*) from pg_temp.ld1_teams t join (values ('0bf96da1-3a1d-4ff0-afbd-d44a2c50ef84'::uuid,'Vienna United'),('153076a7-7c46-4f00-a4ac-4de2553c80fa'::uuid,'POLFIN KOŠ Celovec'),('3dcdb610-7969-46f2-bff4-154f859c07c6'::uuid,'Future Team Steiermark'),('6209c6a2-8af4-4377-830b-7e5335f50628'::uuid,'BBU Salzburg'),('75900f03-087a-4e35-b8c8-1d83ec9f098f'::uuid,'Basketball Klub Rapid Wien'),('7a1a633b-61ae-4daa-9c44-8146a36ed3c6'::uuid,'Safare Traiskirchen Lions NexGen'),('90901ff7-6c21-45b2-8870-9b5438ed8618'::uuid,'Haustechnik Güssing Blackbirds'),('9218ee90-f7fb-4a18-b274-2098f6aaba63'::uuid,'Upper Austrian Ballers'),('999f330c-363a-442f-91ee-6b00188b0fa6'::uuid,'UKJ Mistelbach Mustangs'),('a0ed5191-6ed2-44d9-a17d-43134b94177f'::uuid,'Vienna Timberwolves'),('b6c81f3a-6f48-4d20-a9b1-665e2f05d85a'::uuid,'ASKÖ Radenthein Garnets'),('ba41323f-a2a3-4a33-8c3c-87f9ba4a3b44'::uuid,'SWARCO Raiders Tirol'),('d53c5c05-b59a-4fe6-b844-562c37b011c1'::uuid,'Wörthersee Piraten'),('d6651191-c56d-4d60-ac30-cc7b8a5edbfb'::uuid,'Raiffeisen Mattersburg Rocks'),('e867479f-71a5-4bdd-81d8-35b2da7b1e88'::uuid,'Union Deutsch Wagram Alligators')) e(id,name) on t.id=e.id and t.name=e.name where t.league_id=lid and t.country='Austria' and t.basketball_type='mens' and t.active)<>expected_count
 or exists(select 1 from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and (team_id<>all(clubs) or active is not true))
 then raise exception 'Austria official season roster changed; review required';end if;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
 select gen_random_uuid(),id,lid,'2026-27',true from unnest(clubs) id on conflict(team_id,league_id,season) do nothing;
 if (select count(*) from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and active)<>expected_count then raise exception 'Austria season membership count mismatch';end if;
end $austria$;
