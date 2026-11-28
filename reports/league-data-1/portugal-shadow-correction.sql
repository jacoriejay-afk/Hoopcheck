-- Directory projection only. Run exclusively in temporary tables; no public writes.
-- FPB official 2026/27 lists: https://www.fpb.pt/noticia/o-arranque-de-2026-2027-sorteio-das-ligas-betclic-masculina-e-feminina-este-sabado-no-cop/
-- Preserve all legacy IDs, canonical IDs, existing international records, and every historical membership.
do $portugal$
declare
 men constant uuid := '760c8720-284d-45be-8354-3455e4aa1c69';
 women constant uuid := 'b94bec3a-0da9-4e1e-aabf-82c9b6db4415';
 men_ids uuid[] := array['ef1024d2-8a32-48a8-ac36-753ae7bf4ae1','e9bdaa56-1bc9-4424-bbf0-3accc7e6f24e','6bb5c760-93c9-4d41-9272-fbe5d62fa2e2','81578f84-3ac6-4c73-9a65-271dd3604782','585f8592-c654-4cda-9c21-6744206f3a3a','2bfdb734-5189-4ec8-a36f-fc34d012f8a3','46dec1dd-1158-4d51-a38c-8e3c506481e2','742d2946-6606-44e7-82f8-225ca083e7bf','273de72c-95ba-4c0b-ac0c-2580f17b0efb','d104e37b-2e79-4395-8c71-d20632207e0a','338efab4-c7d3-440c-964a-3d829a08a97a','9d072d6c-6706-4125-84eb-5d5f5830652e']::uuid[];
 men_names text[] := array['CAB Madeira','CD Póvoa ESC Online','Esgueira Aveiro OLI','FC Porto','Portimonense SC','Ovarense GAVEX','Queluz | O Nosso Prego','SC Braga','SL Benfica','Sporting CP','UD Oliveirense','Vitória SC'];
 existing_ids uuid[] := array['776b06f5-d661-4989-bdef-0ef3089db756','c40fc36c-6327-4d51-bf32-cada5e4f5dca','91fd819b-4e27-4115-8a5d-cae220b29364']::uuid[];
 existing_names text[] := array['Benfica Women','Sporting CP Women','União Sportiva Women'];
 new_names text[] := array['Basquete Barcelos','CAB Madeira','CDE Francisco Franco','CRC Quinta dos Lombos','Esgueira','GDESSA Barreiro','GDRAR','Sanjoanense','SC Coimbrões'];
 new_id uuid; i int;
begin
 if not exists(select 1 from pg_temp.ld1_leagues where id=men and country='Portugal' and name='Liga Betclic' and season='2026-27' and basketball_type='mens' and active)
 or not exists(select 1 from pg_temp.ld1_legacy_leagues where id=women and country='Portugal' and name='Portugal Women’s Basketball League' and active)
 or exists(select 1 from pg_temp.ld1_leagues where country='Portugal' and basketball_type='womens' and id<>women)
 or exists(select 1 from pg_temp.ld1_leagues where id=women and (name is distinct from 'Liga Betclic Feminina' or country is distinct from 'Portugal' or season is distinct from '2026-27' or basketball_type is distinct from 'womens' or active is not true))
 or (select count(*) from pg_temp.ld1_teams where league_id=men and active)<>12
 then raise exception 'Portugal competition identity changed'; end if;
 for i in 1..12 loop
  if not exists(select 1 from pg_temp.ld1_teams where id=men_ids[i] and name=men_names[i] and league_id=men and country='Portugal' and basketball_type='mens' and active)
  then raise exception 'Portugal men identity changed';end if;
 end loop;
 for i in 1..3 loop
  if not exists(select 1 from pg_temp.ld1_legacy_teams where id=existing_ids[i] and name=existing_names[i] and league_id=women and country='Portugal' and active)
  or not exists(select 1 from pg_temp.ld1_teams where id=existing_ids[i] and name=existing_names[i] and (league_id is null or league_id=women) and country='Portugal' and basketball_type='womens' and active)
  then raise exception 'Portugal existing women identity changed';end if;
 end loop;
 insert into pg_temp.ld1_leagues(id,name,country,season,basketball_type,active)
 values(women,'Liga Betclic Feminina','Portugal','2026-27','womens',true) on conflict(id) do nothing;
 update pg_temp.ld1_teams set league_id=women where id=any(existing_ids) and league_id is null;
 for i in 1..9 loop
  new_id:=('19502627-732b-5b37-8e62-'||lpad(i::text,12,'0'))::uuid;
  if exists(select 1 from pg_temp.ld1_teams where id=new_id and (name is distinct from new_names[i] or country is distinct from 'Portugal' or league_id is distinct from women or basketball_type is distinct from 'womens' or active is not true))
  or exists(select 1 from pg_temp.ld1_legacy_teams where id=new_id and (name is distinct from new_names[i] or country is distinct from 'Portugal' or league_id is distinct from women or active is not true))
  or exists(select 1 from pg_temp.ld1_teams where id<>new_id and country='Portugal' and basketball_type='womens' and lower(trim(name))=lower(new_names[i]))
  or exists(select 1 from pg_temp.ld1_legacy_teams where id<>new_id and country='Portugal' and lower(trim(name))=lower(new_names[i]))
  then raise exception 'Portugal proposed women identity collision';end if;
  insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active)
  values(new_id,new_names[i],'Portugal',women,'Liga Betclic Feminina','womens',true) on conflict(id) do nothing;
  insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active)
  values(new_id,new_names[i],'Portugal',women,'Liga Betclic Feminina',true) on conflict(id) do nothing;
 end loop;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
 select gen_random_uuid(),id,men,'2026-27',true from unnest(men_ids) id
 on conflict(team_id,league_id,season) do update set active=excluded.active;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
 select gen_random_uuid(),id,women,'2026-27',true from pg_temp.ld1_teams where league_id=women and country='Portugal' and basketball_type='womens' and active
 on conflict(team_id,league_id,season) do update set active=excluded.active;
 if (select count(*) from pg_temp.ld1_memberships where league_id=men and season='2026-27' and active)<>12
 or (select count(*) from pg_temp.ld1_teams where league_id=women and active and basketball_type='womens')<>12
 or (select count(*) from pg_temp.ld1_legacy_teams w join pg_temp.ld1_teams t on t.id=w.id join pg_temp.ld1_memberships m on m.team_id=t.id and m.league_id=women and m.season='2026-27' and m.active where w.league_id=women and t.league_id=women and w.active and t.active and t.basketball_type='womens')<>12
 then raise exception 'Portugal official roster coverage assertion failed';end if;
end $portugal$;
