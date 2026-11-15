-- GROUPS-1: read-only directory filter baseline and pagination validation.
-- Query shape matches the team_fan_groups -> teams inner join used by the UI.
select count(*) as visible_club_groups,
       count(distinct t.country) as available_countries,
       count(distinct t.league_name) as available_leagues
from public.team_fan_groups g
join public.teams t on t.id=g.team_id;

-- Detect groups unexpectedly omitted by the inner join.
select count(*) as missing_team_join
from public.team_fan_groups g
left join public.teams t on t.id=g.team_id
where t.id is null;

-- Validate that a country/league selection is counted before pagination.
-- This is a deterministic sample drawn from existing data, not a hardcoded region.
with sample as (
  select t.country,t.league_name
  from public.team_fan_groups g join public.teams t on t.id=g.team_id
  where t.country is not null and t.league_name is not null
  order by t.country,t.league_name limit 1
)
select s.country,s.league_name,count(*) as matching_groups
from sample s join public.teams t on t.country=s.country and t.league_name=s.league_name
join public.team_fan_groups g on g.team_id=t.id
group by s.country,s.league_name;
