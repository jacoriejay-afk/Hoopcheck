-- Directory-only rehearsal. Never execute against public tables.
-- Official 2026-27 opening-round fixture list:
-- https://mediacentre.euroleague.net/en/app/2/communication/communication/preview/24407
-- Sixteen direct club IDs plus four existing active season membership IDs.
-- Preserve all domestic aliases and affiliations; no identity merge or arbitrary primary selection.
do $euro$
declare
 league constant uuid := 'def7c31c-552a-4786-a2e9-66a2d1055b7f';
 direct_ids uuid[] := array['cff56b3a-a50d-4064-bddd-5d168851e09c','5840ee52-9f18-4eb9-9aa9-5100f1efa780','0bd859f2-f3c3-4bb4-8d5e-1a322bd920e9','60b1d9f4-542f-4f67-816c-a08e04abbc79','976e4b88-8891-474a-84a5-5f12527918da','70df0c30-3e37-4ec3-832b-4a6adc48ee7b','b63b8648-2923-4097-9751-9e7216130953','8add03bb-1c13-47e8-9b63-ba42d7d23217','e047864d-f5d3-49b1-a295-055ee48621cf','ee4e3d33-135f-4653-9bce-366ae621fd4d','c0d54bbf-c43e-482f-a6dc-7bfa1536cd85','872b6ade-33d6-4042-90c3-43b98646bc11','3160698a-4c2d-4192-9408-2be0d94ba869','cad10ce7-f0e1-4b49-b2e6-15e9883326a2','9b049a09-7138-44dc-8609-58be7e4299a8','97947932-202f-4b63-826b-5ee6b19e4aa0']::uuid[];
 direct_names text[] := array['Armani Olimpia Milano','Beşiktaş Istanbul','Crvena Zvezda Meridianbet Belgrade','Dubai Basketball','FC Bayern Munich','Hapoel IBI Tel Aviv','Kosner Baskonia Vitoria-Gasteiz','LDLC ASVEL Villeurbanne','Maccabi Rapyd Tel Aviv','Olympiacos Piraeus','Panathinaikos AKTOR Athens','Paris Basketball','Partizan Mozzart Bet Belgrade','Valencia Basket','Virtus Bologna','Zalgiris Kaunas'];
 linked_ids uuid[] := array['a5d8c854-12b5-4b03-a2e2-e2d9752e2ea7','5da14bb6-6c62-495c-a244-025ca72e4334','615088e0-10db-4cd8-9ec2-d9ca9b871eba','61ee3c85-4edd-42b1-bc49-b6665d3aa0e6']::uuid[];
 linked_names text[] := array['Anadolu Efes Istanbul','FC Barcelona','Fenerbahçe Tarfin Istanbul','Real Madrid'];
 i int;
begin
 if not exists(select 1 from pg_temp.ld1_leagues where id=league and name='EuroLeague' and country='Europe' and season='2026-27' and basketball_type='mens' and active)
 or (select count(*) from pg_temp.ld1_teams where league_id=league and active)<>16
 or exists(select 1 from pg_temp.ld1_memberships where league_id=league and season='2026-27' and (team_id<>all(direct_ids||linked_ids) or active is not true))
 then raise exception 'EuroLeague scope changed; review required';end if;
 for i in 1..16 loop
  if not exists(select 1 from pg_temp.ld1_teams where id=direct_ids[i] and name=direct_names[i] and league_id=league and basketball_type='mens' and active)
  then raise exception 'EuroLeague direct identity changed';end if;
 end loop;
 for i in 1..4 loop
  if not exists(select 1 from pg_temp.ld1_teams t join pg_temp.ld1_memberships m on m.team_id=t.id where t.id=linked_ids[i] and t.name=linked_names[i] and t.basketball_type='mens' and t.active and m.league_id=league and m.season='2026-27' and m.active)
  then raise exception 'EuroLeague linked identity changed';end if;
 end loop;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
 select gen_random_uuid(),id,league,'2026-27',true from unnest(direct_ids) id
 on conflict(team_id,league_id,season) do nothing;
 if (select count(*) from pg_temp.ld1_memberships where league_id=league and season='2026-27' and active)<>20
 then raise exception 'EuroLeague current season roster mismatch';end if;
end $euro$;
