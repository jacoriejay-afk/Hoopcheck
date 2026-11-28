-- LEAGUE-DATA-1: correction rehearsal, never a production migration.
-- This file intentionally references ONLY session-local pg_temp tables.
-- Apply twice against the directory-only snapshot, then roll back.
-- Source verification 2026-11-28:
-- Armenia announced roster: https://sportaran.com/en/post/probasket-a-league-vozvrashaetsya-v-novom-sezone-vystupyat-10-komand-iz-pyati-stran/
-- Opening round: https://www.aravot.am/2026/11/02/1590782/
-- Erebuni/BKMA historical: https://www.eurobasket.com/Armenia/basketball-A-League_2025-2026.aspx
-- Erebuni/BKMA separate championship: https://www.eurobasket.com/Armenia/basketball-Championship.aspx
-- Azerbaijan federation final list and Sheki transfer: https://aze.basketball/News/News/abl-klublar-2026-2027-yekun-klublar-abl
-- Azerbaijan historical: https://aze.basketball/News/News/abl-play-off-da-istirak-edck-butun-klublar-muyynlsib
-- Newly recognized secondary competitions have incomplete roster verification.
-- Barsy and Neftchi possible aliases are deliberately NOT consolidated.
do $ld1$
declare
  arm constant uuid := '3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4';
  az constant uuid := 'bec85eb7-a0c3-4147-9ab8-3a7e870d0d01';
  bkma constant uuid := '68fd74f0-40f4-5035-8659-fbb56e6404c2';
  erebuni constant uuid := '9e64dea2-9ce1-4557-bc89-badf9bbccf98';
  sheki constant uuid := '13d42da3-e488-4c8a-9435-78fd743ec2c2';
  arm2 constant uuid := 'b9321e1e-08c2-5ad1-ad44-bf339a4544d2';
  az2 constant uuid := '7618714d-3a1a-50d5-be64-01c44559264b';
  arm_ids uuid[] := array[
    '1b9f224e-4cd7-4823-a1ec-4304a5db7223',
    'edb90cf2-5ed6-4f2c-b3bf-a6f1a656c61e',
    'ec10f425-223b-426f-b16a-61147fa715fc',
    '6978f3db-8091-48f8-89fb-e6a025a51c4d',
    'c8a110b7-b492-411a-ba94-54cd74188a2c',
    '61fb17ac-cee4-4b15-bd18-388b344d9c63',
    '32985fdd-2cde-4fd9-b228-fd5215b480ac',
    'ec170351-9301-4e30-a24c-71dfa59ae5f8',
    '7a7e6d9f-c282-41ea-903b-51d267d37f78',
    bkma::text]::uuid[];
  az_ids uuid[] := array[
    '16ec24d3-bf74-4bc2-9a2d-b15c5e4e27e8',
    'df493661-c77b-4eb3-9586-d2adf32e22e6',
    'a8785ea3-bcf1-4d7d-850f-fb73cd34672f',
    'fd34a172-7aed-4cb5-8e21-ce05d8aa7d09',
    '71fa7dc8-9044-482c-979a-8935ddf8039a',
    '052a8ee3-4c02-4932-bfc8-174bfb8578ae',
    '6773b937-41b3-406e-b2e1-ab48cb1d8bc7',
    '3cb30a4c-3b54-4db2-84d7-0fff3a20a9a1']::uuid[];
begin
  if not exists(select 1 from pg_temp.ld1_leagues where id=arm and country='Armenia' and name='Armenian Basketball League A' and season='2026-27' and active is true and basketball_type='mens')
     or not exists(select 1 from pg_temp.ld1_leagues where id=az and country='Azerbaijan' and name='Azerbaijan Basketball League' and season='2026-27' and active is true and basketball_type='mens')
     or not exists(select 1 from pg_temp.ld1_teams where id=erebuni and country='Armenia' and name='BK Erebuni' and league_id in (arm,arm2) and active is true)
     or not exists(select 1 from pg_temp.ld1_teams where id=sheki and country='Azerbaijan' and name='Sheki BK' and league_id in (az,az2) and active is true)
     or (select count(*) from pg_temp.ld1_teams where id=any(arm_ids) and id<>bkma and league_id=arm and active is true and basketball_type='mens')<>9
     or (select count(*) from pg_temp.ld1_teams where id=any(az_ids) and country='Azerbaijan' and league_id=az and active is true and basketball_type='mens')<>8 then
       raise exception 'Roster preconditions changed; review exact identities';
  end if;
  if exists(select 1 from pg_temp.ld1_teams where id=bkma and (name<>'BKMA' or country<>'Armenia' or league_id is distinct from arm))
     or exists(select 1 from pg_temp.ld1_teams where id<>bkma and country='Armenia' and basketball_type='mens' and lower(trim(name)) in ('bkma','bc bkma','bkma yerevan'))
     or exists(select 1 from pg_temp.ld1_leagues where id=arm2 and (name<>'Armenian Championship' or country<>'Armenia'))
     or exists(select 1 from pg_temp.ld1_leagues where id=az2 and (name<>'Azerbaijan Basketball League 2' or country<>'Azerbaijan'))
     or exists(select 1 from pg_temp.ld1_leagues where id<>arm2 and country='Armenia' and lower(trim(name)) in ('armenian championship','armenia championship'))
     or exists(select 1 from pg_temp.ld1_leagues where id<>az2 and country='Azerbaijan' and lower(trim(name)) in ('azerbaijan basketball league 2','abl2','abl 2')) then
       raise exception 'Proposed identity collision; no guessed duplicate merge';
  end if;
  insert into pg_temp.ld1_leagues(id,name,country,season,basketball_type,active)
    values (arm2,'Armenian Championship','Armenia','2026-27','mens',true),
           (az2,'Azerbaijan Basketball League 2','Azerbaijan','2026-27','mens',true)
    on conflict(id) do nothing;
  insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active)
    values(bkma,'BKMA','Armenia',arm,'Armenian Basketball League A','mens',true)
    on conflict(id) do nothing;
  update pg_temp.ld1_teams set league_id=arm2,league_name='Armenian Championship' where id=erebuni and league_id=arm;
  update pg_temp.ld1_teams set league_id=az2,league_name='Azerbaijan Basketball League 2' where id=sheki and league_id=az;
  insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
    select gen_random_uuid(),t,arm,'2026-27',true from unnest(arm_ids) t
    on conflict(team_id,league_id,season) do update set active=excluded.active;
  insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
    select gen_random_uuid(),t,az,'2026-27',true from unnest(az_ids) t
    on conflict(team_id,league_id,season) do update set active=excluded.active;
  insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active)
    values (gen_random_uuid(),erebuni,arm,'2025-26',false),
           (gen_random_uuid(),bkma,arm,'2025-26',false),
           (gen_random_uuid(),sheki,az,'2025-26',false),
           (gen_random_uuid(),erebuni,arm2,'2026-27',true),
           (gen_random_uuid(),bkma,arm2,'2026-27',true),
           (gen_random_uuid(),sheki,az2,'2026-27',true)
    on conflict(team_id,league_id,season) do update set active=excluded.active;
  if (select count(*) from pg_temp.ld1_teams where league_id=arm and active is true)<>10
     or (select count(*) from pg_temp.ld1_teams where league_id=az and active is true)<>8
     or (select count(*) from pg_temp.ld1_memberships where league_id=arm and season='2026-27' and active is true)<>10
     or (select count(*) from pg_temp.ld1_memberships where league_id=az and season='2026-27' and active is true)<>8
     or (select count(distinct t.country) from pg_temp.ld1_memberships m join pg_temp.ld1_teams t on t.id=m.team_id where m.league_id=arm and m.season='2026-27' and m.active is true)<>5
     or (select count(*) from pg_temp.ld1_memberships where team_id=bkma and season='2026-27' and active is true and league_id in (arm,arm2))<>2
     or not exists(select 1 from pg_temp.ld1_memberships where team_id=erebuni and league_id=arm and season='2025-26' and active is false)
     or not exists(select 1 from pg_temp.ld1_memberships where team_id=sheki and league_id=az and season='2025-26' and active is false)
     or not exists(select 1 from pg_temp.ld1_teams where id='b17c59fb-b5a1-4646-bbcf-c1587346fe67' and country='Kazakhstan' and league_id='1e92579b-b1ab-473c-bc0f-89f2b03217e5') then
       raise exception 'Roster, foreign origin, history or multi-competition assertion failed';
  end if;
end $ld1$;
