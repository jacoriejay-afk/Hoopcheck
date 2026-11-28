-- Run only after iceland-womens-shadow-expansion.sql against session-local projections.
-- Both existing UI namespaces are populated by the same new club IDs; no existing ID is remapped.
-- ld1_legacy_leagues and ld1_legacy_teams must model the actual legacy FK.
-- This is a candidate rehearsal, not a production migration or trigger replacement.
do $legacy$
declare
 target constant uuid := 'c1102127-379f-5d5a-8221-f6eaf93c7c28';
begin
 if exists(select 1 from pg_temp.ld1_legacy_leagues where country='Iceland' and id<>target)
 or exists(select 1 from pg_temp.ld1_legacy_leagues where id=target and (name is distinct from 'Bónus deild kvenna' or country is distinct from 'Iceland' or active is not true))
 or exists(select 1 from pg_temp.ld1_legacy_teams w where w.country='Iceland' and not exists(select 1 from pg_temp.ld1_teams t where t.id=w.id and t.league_id=target and t.basketball_type='womens'))
 or exists(select 1 from pg_temp.ld1_legacy_teams w join pg_temp.ld1_teams t on t.id=w.id where t.league_id=target and (w.name is distinct from t.name or w.country is distinct from t.country or w.league_id is distinct from target or w.active is not true))
 then raise exception 'Legacy Iceland identity collision; independent review required';end if;
 insert into pg_temp.ld1_legacy_leagues(id,name,country,active)
 values(target,'Bónus deild kvenna','Iceland',true) on conflict(id) do nothing;
 insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active)
 select id,name,country,target,league_name,true from pg_temp.ld1_teams
 where league_id=target and country='Iceland' and basketball_type='womens' and active is true
 on conflict(id) do nothing;
 if (select count(*) from pg_temp.ld1_legacy_teams where league_id=target and active is true)<>10
 or (select count(*) from pg_temp.ld1_legacy_teams w join pg_temp.ld1_teams t on t.id=w.id join pg_temp.ld1_memberships m on m.team_id=t.id and m.league_id=target and m.season='2026-27' and m.active is true where w.league_id=target and w.active is true and t.league_id=target and t.basketball_type='womens' and t.active is true)<>10
 then raise exception 'Legacy/canonical/season linkage check failed';end if;
end $legacy$;
