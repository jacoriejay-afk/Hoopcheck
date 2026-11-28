-- Synthetic rollback-only rehearsal. Never modifies persistent tables.
-- This tests the proposed membership model, not full hosted schema/RLS/triggers.
begin;
create temporary table ld1_teams(id text primary key, name text not null, country text not null, primary_league text, active boolean not null) on commit drop;
create temporary table ld1_memberships(team_id text references ld1_teams(id), league_id text, season text, active boolean not null, primary key(team_id,league_id,season)) on commit drop;
create temporary table ld1_refs(id text primary key, team_id text references ld1_teams(id)) on commit drop;
insert into pg_temp.ld1_teams values
 ('yangs','BC YANGS','Armenia','armenia-a',true),
 ('urartu','Urartu BC','Armenia','armenia-a',true),
 ('hatis','BC HATIS','Armenia','armenia-a',true),
 ('hat','BC HAT','Armenia','armenia-a',true),
 ('erebuni','BK Erebuni','Armenia','armenia-a',true),
 ('cross','BC CROSSNATION','United States','armenia-a',true),
 ('phoenix','BC PHOENIX PERCEPTION','United States','armenia-a',true),
 ('tbilisi','BC TBILISI BTB','Georgia','armenia-a',true),
 ('barsy','Barsy Atyrau','Kazakhstan','kazakhstan-national',true),
 ('barsy-alias','BC BARSY ATYRAU','Kazakhstan','armenia-a',true),
 ('nomad','BC NOMAD','Kyrgyzstan','armenia-a',true);
insert into pg_temp.ld1_refs values ('historical-review','erebuni'),('alias-follower','barsy-alias'),('domestic-career','barsy');
-- Rehearse twice to prove stable IDs and no duplicate memberships.
do $test$
declare pass integer;
begin
 for pass in 1..2 loop
   insert into pg_temp.ld1_teams values ('bkma','BKMA','Armenia','armenia-a',true)
     on conflict (id) do nothing;
   insert into pg_temp.ld1_memberships
     values ('erebuni','armenia-a','2025-26',false)
     on conflict (team_id,league_id,season) do nothing;
   -- A production reconciliation would first need a verified alias redirect
   -- and all foreign-key dependents reviewed. Do not delete either record.
   update pg_temp.ld1_teams set primary_league=null where id in ('erebuni','barsy-alias') and primary_league='armenia-a';
   insert into pg_temp.ld1_memberships(team_id,league_id,season,active)
     select id,'armenia-a','2026-27',true from pg_temp.ld1_teams
     where id in ('yangs','urartu','hatis','hat','bkma','cross','phoenix','tbilisi','barsy','nomad')
     on conflict (team_id,league_id,season) do update set active=excluded.active;
   if (select count(*) from pg_temp.ld1_memberships where league_id='armenia-a' and season='2026-27' and active)<>10 then raise exception 'expected ten memberships'; end if;
   if (select count(*) from pg_temp.ld1_teams where id='erebuni' and active)<>1 then raise exception 'Erebuni identity lost'; end if;
   if (select count(*) from pg_temp.ld1_memberships where team_id='erebuni' and season='2025-26' and not active)<>1 then raise exception 'history lost'; end if;
   if (select count(*) from pg_temp.ld1_teams where id='barsy' and country='Kazakhstan' and primary_league='kazakhstan-national')<>1 then raise exception 'domestic affiliation changed'; end if;
   if (select count(*) from pg_temp.ld1_refs)<>3 then raise exception 'dependent refs lost'; end if;
   if (select count(*) from pg_temp.ld1_teams)<>12 then raise exception 'identity count changed'; end if;
   if (select count(*) from pg_temp.ld1_memberships)<>11 then raise exception 'membership idempotency failed'; end if;
   if (select count(distinct t.country) from pg_temp.ld1_memberships m join pg_temp.ld1_teams t on t.id=m.team_id where m.season='2026-27' and m.active)<>5 then raise exception 'foreign origins lost'; end if;
   if (select count(*) from pg_temp.ld1_teams where id='barsy-alias')<>1 then raise exception 'alias removed'; end if;
 end loop;
end $test$;
select 'PASS: two fixture passes; 10 current, 1 historical, 5 origins, 12 identities, 3 dependent refs' as result;
rollback;
