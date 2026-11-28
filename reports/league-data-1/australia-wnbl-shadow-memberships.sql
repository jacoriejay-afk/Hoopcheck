-- WNBL 2026-27: nine confirmed clubs, all existing primary-linked IDs.
-- Official league schedule, 2026-09-22:
-- https://www.wnbl.com.au/news/how-to-watch-the-wnbl27-season?964d7745_page=2
-- UC Capitals and Southside Melbourne Flyers match stored Canberra Capitals and Southside Flyers.
-- Ten unlinked active identities require separate alias/history review; no changes to them.
-- Temporary projection only, never a migration.
do $wnbl$
declare lid constant uuid := 'c7aa0182-a9ab-483a-9e51-323e593506b1'; c record; ids uuid[] := array['e11d8652-598a-4e0d-bbea-44d297bee99d','6db3a348-4805-4ecd-9643-a432c2b0d0f1','3a9fea39-4a1b-46b8-b560-878ef37e1365','0d5c11d4-fe27-4e4b-be1c-3378b8af9e79','88e00642-e7a9-4c9c-9b6d-ada5caf089be','8ddf86bb-733c-4af0-9e20-3cda8c229f6b','7ae90ad5-cb60-4ae4-a2a7-6d52578de0c2','58355c85-eebe-4ce0-915d-7848e838ab03','243702e4-b4a4-4230-becd-a16a46d61033']::uuid[];
begin
 if not exists(select 1 from pg_temp.ld1_leagues where id=lid and name='WNBL' and country='Australia' and basketball_type='womens' and season='2026-27' and active) then raise exception 'WNBL league changed'; end if;
 if (select count(*) from pg_temp.ld1_teams where league_id=lid and active)<>9 or exists(select 1 from pg_temp.ld1_teams where league_id=lid and active and id<>all(ids)) then raise exception 'WNBL primary roster changed'; end if;
 if exists(select 1 from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and (team_id<>all(ids) or active is not true)) then raise exception 'WNBL unexpected or inactive season membership'; end if;
 for c in select * from (values
('e11d8652-598a-4e0d-bbea-44d297bee99d'::uuid,'Adelaide Lightning'),
('6db3a348-4805-4ecd-9643-a432c2b0d0f1'::uuid,'Bendigo Spirit'),
('3a9fea39-4a1b-46b8-b560-878ef37e1365'::uuid,'Canberra Capitals'),
('0d5c11d4-fe27-4e4b-be1c-3378b8af9e79'::uuid,'Geelong Venom'),
('88e00642-e7a9-4c9c-9b6d-ada5caf089be'::uuid,'Perth Lynx'),
('8ddf86bb-733c-4af0-9e20-3cda8c229f6b'::uuid,'Southside Flyers'),
('7ae90ad5-cb60-4ae4-a2a7-6d52578de0c2'::uuid,'Sydney Flames'),
('58355c85-eebe-4ce0-915d-7848e838ab03'::uuid,'Tasmania Jewels'),
('243702e4-b4a4-4230-becd-a16a46d61033'::uuid,'Townsville Fire')
 ) v(id,name) loop
  if not exists(select 1 from pg_temp.ld1_teams t where t.id=c.id and t.name=c.name and t.country='Australia' and t.basketball_type='womens' and t.league_id=lid and t.active) then raise exception 'WNBL identity changed: %',c.name; end if;
  insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active) values(gen_random_uuid(),c.id,lid,'2026-27',true) on conflict(team_id,league_id,season) do nothing;
 end loop;
 if (select count(*) from pg_temp.ld1_memberships where league_id=lid and season='2026-27' and active)<>9 then raise exception 'WNBL season membership count mismatch'; end if;
end $wnbl$;
