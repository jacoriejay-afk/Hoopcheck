-- Federation-attributed 2026/27 opening fixtures: https://www.bhbasket.ba/start-a1-lige-ksbih-sezona-2026-2027-raspored-1-kola-i-delegirana-sluzbena-lica/
-- Complete 13-club list: https://www.bhbasket.ba/klubovi-koji-ce-igrati-u-a1-ligi/
-- Only 12 unambiguous directory IDs linked; Živinice remains unresolved because
-- two other active IDs carry primary links to the top-flight competition aliases.
-- Temporary directory correction only; no production writes.
do $bih_a1$
declare
 lid constant uuid := 'b1a12027-375e-54c0-96ab-000000000001';
 clubs uuid[] := array['2a91fdce-a33b-42c1-8bbc-938d8cffe007','3017e3c3-2383-40f0-bb62-0c67a48e1fcd','4e18c665-967e-4ed5-ab99-e6be2087d627','543f0108-304c-4631-832b-ba5c57c57889','5c0f2eba-64ab-4982-b00a-0c6838a7b7b4','6b6323a0-11a6-4fca-bc4f-24444eedca69','72f875d2-0d27-41ac-9c54-2df4702b7a2d','94b3e8a4-8281-4434-acd1-e9d98cb170a0','a7fe1eb1-23cb-497a-9289-860542cbf64c','d2a408a6-6e25-48d8-a77c-bfcabefb8031','e0f4d93f-d3fa-45fc-b079-b9e859cce949','ee11636d-4bfe-4f13-8b1b-6bd75cb60c11']::uuid[];
begin
 if exists(select 1 from pg_temp.ld1_leagues where id=lid and (name is distinct from 'A1 Liga BiH' or country is distinct from 'Bosnia and Herzegovina' or season is distinct from '2026-27' or basketball_type is distinct from 'mens' or active is not true))
 or exists(select 1 from pg_temp.ld1_leagues where id<>lid and country in ('Bosnia and Herzegovina','Bosnia & Herzegovina') and basketball_type='mens' and name ilike '%a1%')
 or (select count(*) from pg_temp.ld1_teams t join (values ('2a91fdce-a33b-42c1-8bbc-938d8cffe007'::uuid,'KK Kakanj'),('3017e3c3-2383-40f0-bb62-0c67a48e1fcd'::uuid,'KK Travnik'),('4e18c665-967e-4ed5-ab99-e6be2087d627'::uuid,'KK Željo 1971'),('543f0108-304c-4631-832b-ba5c57c57889'::uuid,'OKK Gradina Srebrenik'),('5c0f2eba-64ab-4982-b00a-0c6838a7b7b4'::uuid,'KK Bošnjak'),('6b6323a0-11a6-4fca-bc4f-24444eedca69'::uuid,'KK Gradačac'),('72f875d2-0d27-41ac-9c54-2df4702b7a2d'::uuid,'UKK IUS-Famos'),('94b3e8a4-8281-4434-acd1-e9d98cb170a0'::uuid,'KK Bosna Spars'),('a7fe1eb1-23cb-497a-9289-860542cbf64c'::uuid,'KK Vogošća'),('d2a408a6-6e25-48d8-a77c-bfcabefb8031'::uuid,'KK Konjic'),('e0f4d93f-d3fa-45fc-b079-b9e859cce949'::uuid,'OKK Čelik'),('ee11636d-4bfe-4f13-8b1b-6bd75cb60c11'::uuid,'KK Turbina')) e(id,name) on t.id=e.id and t.name=e.name where t.country='Bosnia and Herzegovina' and t.basketball_type='mens' and t.active and t.league_name='A1 Liga BiH' and (t.league_id is null or t.league_id=lid))<>12
 or exists(select 1 from pg_temp.ld1_teams where league_id=lid and active and id<>all(clubs))
 or exists(select 1 from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and (team_id<>all(clubs) or active is not true))
 then raise exception 'A1 BiH identity or affiliation changed; review required';end if;
 insert into pg_temp.ld1_leagues(id,name,country,season,basketball_type,active) values(lid,'A1 Liga BiH','Bosnia and Herzegovina','2026-27','mens',true) on conflict(id) do nothing;
 update pg_temp.ld1_teams set league_id=lid where id=any(clubs) and league_id is null;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active) select gen_random_uuid(),id,lid,'2026-27',true from unnest(clubs) id on conflict(team_id,league_id,season) do nothing;
 if (select count(*) from pg_temp.ld1_teams where league_id=lid and active)<>12 or (select count(*) from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and active)<>12 then raise exception 'A1 reviewed subset mismatch';end if;
end $bih_a1$;
