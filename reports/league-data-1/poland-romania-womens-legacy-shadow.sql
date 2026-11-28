-- Add only source-reviewed domestic teams without a conflicting legacy identity.
-- Poland: https://basketligakobiet.pl/aktualnosci/n/14067/13-klubow-z-licencjami-na-sezon-2026-2027.html
-- Romania: https://www.frbaschet.ro/stiri/generale/incep-campionatele-nationale-de-seniori-0
-- Requires prior Brazil/Poland and four-country canonical correction scripts.
-- Never create a new club ID or modify an existing legacy record.
do $legacy_mirror$
declare c record;
begin
 for c in select * from (values
('5ecdbfd5-83cd-4c90-9594-1e8833aa8a39'::uuid,'Isands JTEC Wichoś Jelenia Góra','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992'::uuid,'Polish Women’s Basketball League'),
('85b88d4e-ee35-4f4c-b59d-b4735412e84d'::uuid,'Artego Bydgoszcz','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992'::uuid,'Polish Women’s Basketball League'),
('88b100f7-768b-4a1e-afbe-74fb80ca51e1'::uuid,'Contimax MOSIR Bochnia','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992'::uuid,'Polish Women’s Basketball League'),
('8a51fc72-9b7d-4889-8c92-16ec1e144c8e'::uuid,'PGE Wisła Kraków','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992'::uuid,'Polish Women’s Basketball League'),
('a846b49a-9afc-4486-819f-c28b91630ae9'::uuid,'Energa Toruń','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992'::uuid,'Polish Women’s Basketball League'),
('ad04901c-6d65-4978-aa1a-f53af3c988e7'::uuid,'MB Zagłębie Sosnowiec','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992'::uuid,'Polish Women’s Basketball League'),
('cc80c12d-27fb-4185-8ade-ebd71457a0b9'::uuid,'Widzew Łódź','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992'::uuid,'Polish Women’s Basketball League'),
('d8407e8e-4f36-4ef9-87e0-38fdfb8a64d4'::uuid,'SKK Polonia Warszawa','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992'::uuid,'Polish Women’s Basketball League'),
('de27044d-fe82-48f1-aea8-340f6b99f1f4'::uuid,'Lotto MKS Pruszków','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992'::uuid,'Polish Women’s Basketball League'),
('18c01b60-c607-4f80-a2c5-3f3d0dd605b7'::uuid,'CS Oxigen București','Romania','c8b0fe1b-15ed-4a64-af62-f1d33b6436cc'::uuid,'Romanian Women’s Basketball League'),
('72e524c1-2d10-4885-ab33-57e94b7075d5'::uuid,'CS Agronomia București','Romania','c8b0fe1b-15ed-4a64-af62-f1d33b6436cc'::uuid,'Romanian Women’s Basketball League'),
('768823af-d21d-41ad-ac6b-43e22e8176dd'::uuid,'CSJ Teleorman Alexandria','Romania','c8b0fe1b-15ed-4a64-af62-f1d33b6436cc'::uuid,'Romanian Women’s Basketball League'),
('81c37b3f-ebea-40a6-8e5f-15ac64d7fa86'::uuid,'Sportul Studențesc București Women','Romania','c8b0fe1b-15ed-4a64-af62-f1d33b6436cc'::uuid,'Romanian Women’s Basketball League'),
('907c47c0-9569-4a1d-8812-ece61d87daf5'::uuid,'CSU Politehnica Timișoara Women','Romania','c8b0fe1b-15ed-4a64-af62-f1d33b6436cc'::uuid,'Romanian Women’s Basketball League'),
('e13f73ca-c7ac-4938-8762-0236edb2358d'::uuid,'FCC Baschet UAV Arad','Romania','c8b0fe1b-15ed-4a64-af62-f1d33b6436cc'::uuid,'Romanian Women’s Basketball League')
 ) as x(id,name,country,lid,label) loop
  if not exists(select 1 from pg_temp.ld1_teams t join pg_temp.ld1_leagues l on l.id=t.league_id where t.id=c.id and t.name=c.name and t.country=c.country and t.basketball_type='womens' and t.active and t.league_id=c.lid and l.active and l.basketball_type='womens' and l.season='2026-27')
  or not exists(select 1 from pg_temp.ld1_legacy_leagues w where w.id=c.lid and w.name=c.label and w.country=c.country and w.active)
  or not exists(select 1 from pg_temp.ld1_memberships m where m.team_id=c.id and m.league_id=c.lid and m.season='2026-27' and m.active)
  or exists(select 1 from pg_temp.ld1_legacy_teams w where w.id=c.id and (w.name is distinct from c.name or w.country is distinct from c.country or w.league_id is distinct from c.lid or w.league_name is distinct from c.label or w.active is not true))
  or exists(select 1 from pg_temp.ld1_legacy_teams w where w.id<>c.id and w.country=c.country and lower(regexp_replace(w.name,'[^[:alnum:]]','','g'))=lower(regexp_replace(c.name,'[^[:alnum:]]','','g')))
  then raise exception 'Legacy mirror identity changed: %',c.id;end if;
  insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active) values(c.id,c.name,c.country,c.lid,c.label,true) on conflict(id) do nothing;
 end loop;
end $legacy_mirror$;
