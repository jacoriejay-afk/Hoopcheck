-- Directory-only temporary PostgreSQL rehearsal; not a production migration.
-- Kosovo federation members and current fixtures:
-- https://kosovo.basketball/FbkMember
-- https://kosovo.basketball/Article/NewsSingle?articleId=15469
-- https://kosovo.basketball/Shooter/Competition/25?name=GRUPI+01
-- Bora and Borea are distinct; do not rename Borea or overwrite its identity.
-- Rahoveci 029 vs existing shortened/legacy Rahoveci remains unresolved.
do $kosovo$
declare
 top_id constant uuid := 'fc462d0b-c04b-4e16-be0b-6dd670a02481';
 first_id constant uuid := '0b4753e7-5ad0-57c1-93a3-0dbcb1c023b3';
 bora_id constant uuid := '552a6947-4728-5af7-94f4-0bce732718f5';
 borea_id constant uuid := 'e2e37ee2-8880-4ee1-bd41-fb671ad4c285';
 confirmed uuid[] := array[
  'b2f4321a-40f1-4ee9-a0f1-43474ea2c033',
  '30fae9b9-e685-411e-9ebb-4894b8cf9c1f',
  '18c95a04-0641-45c9-92f5-4736ba6612db',
  '33af8928-cd7e-4748-81fe-6735cd32b2ec',
  '6730c0d1-0416-4756-b731-93cf8c778fb2',
  'f46db307-26b6-46b7-a0f3-de8d2907b1a7']::uuid[];
begin
 if not exists(select 1 from pg_temp.ld1_leagues where id=top_id and country='Kosovo' and name='Kosovo Superleague' and season='2026-27' and basketball_type='mens' and active is true)
 or not exists(select 1 from pg_temp.ld1_teams where id=borea_id and name='KB Borea' and country='Kosovo' and league_id in (top_id,first_id) and basketball_type='mens' and active is true)
 or (select count(*) from pg_temp.ld1_teams where id=any(confirmed) and league_id=top_id and country='Kosovo' and basketball_type='mens' and active is true)<>6
 or exists(select 1 from pg_temp.ld1_teams where id=bora_id and (name is distinct from 'KB Bora' or country is distinct from 'Kosovo' or league_id is distinct from top_id or basketball_type is distinct from 'mens' or active is not true))
 or exists(select 1 from pg_temp.ld1_teams where id<>bora_id and country='Kosovo' and basketball_type='mens' and lower(trim(name)) in ('bora','kb bora','bora basketball'))
 or exists(select 1 from pg_temp.ld1_leagues where id=first_id and (name is distinct from 'Liga e Parë' or country is distinct from 'Kosovo' or season is distinct from '2026-27' or basketball_type is distinct from 'mens' or active is not true))
 or exists(select 1 from pg_temp.ld1_leagues where id<>first_id and country='Kosovo' and basketball_type='mens' and lower(trim(name)) in ('liga e parë','liga e pare','first league','kosovo first league'))
 or exists(select 1 from pg_temp.ld1_memberships where team_id=borea_id and league_id=top_id and season='2026-27' and active is true)
 then raise exception 'Kosovo identity or current membership precondition changed; review required'; end if;
 insert into pg_temp.ld1_leagues(id,name,country,season,basketball_type,active)
 values(first_id,'Liga e Parë','Kosovo','2026-27','mens',true) on conflict(id) do nothing;
 insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active)
 values(bora_id,'KB Bora','Kosovo',top_id,'Kosovo Superleague','mens',true) on conflict(id) do nothing;
 update pg_temp.ld1_teams set league_id=first_id,league_name='Liga e Parë' where id=borea_id and league_id=top_id;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
 select gen_random_uuid(),t,top_id,'2026-27',true from unnest(confirmed||array[bora_id]) t
 on conflict(team_id,league_id,season) do update set active=excluded.active;
 insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
 values(gen_random_uuid(),borea_id,first_id,'2026-27',true)
 on conflict(team_id,league_id,season) do update set active=excluded.active;
 if (select count(*) from pg_temp.ld1_memberships where league_id=top_id and season='2026-27' and active is true)<>7
 or (select count(*) from pg_temp.ld1_teams where league_id=top_id and active is true)<>8
 or not exists(select 1 from pg_temp.ld1_teams where id='6da31ec9-a6d1-427f-b5de-dce092b65dcf' and name='KB Rahoveci' and league_id=top_id)
 or not exists(select 1 from pg_temp.ld1_teams where id=borea_id and name='KB Borea' and league_id=first_id and active is true)
 then raise exception 'Kosovo roster or identity preservation check failed'; end if;
end $kosovo$;
