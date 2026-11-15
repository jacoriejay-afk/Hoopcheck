-- GROUPS-1: READ-ONLY duplicate candidate inventory.
-- Run against the intended environment before reviewing canonical identities.
-- Matching name + country + basketball side is a CANDIDATE only.
-- No inserts, updates, deletes, merges, or privilege changes.
with candidates as (
 select lower(regexp_replace(trim(t.name),'[[:space:]]+',' ','g')) as normalized_name,
        lower(coalesce(trim(t.country),'')) as normalized_country,
        coalesce(t.basketball_type,'') as basketball_side,
        count(*) as team_rows,
        count(distinct t.league_name) as distinct_league_names,
        array_agg(t.id order by t.created_at,t.id) as team_ids,
        array_agg(distinct t.league_name) as leagues
 from public.teams t
 where nullif(trim(t.name),'') is not null
 group by 1,2,3
 having count(*) > 1
)
select * from candidates order by team_rows desc,normalized_country,normalized_name;

-- Assess existing content before choosing survivors:
-- select g.team_id,g.group_name,g.created_at,
--   (select count(*) from public.team_fan_group_members m where m.team_id=g.team_id) as members,
--   (select count(*) from public.team_fan_group_posts p where p.team_id=g.team_id) as posts,
--   (select count(*) from public.team_fan_group_moderators m where m.team_id=g.team_id) as moderators,
--   (select count(*) from public.team_fan_group_join_requests r where r.team_id=g.team_id) as requests,
--   (select count(*) from public.team_fan_group_reports r where r.team_id=g.team_id) as reports
-- from public.team_fan_groups g where g.team_id = any(array[/* reviewed UUIDs */]::uuid[]);
