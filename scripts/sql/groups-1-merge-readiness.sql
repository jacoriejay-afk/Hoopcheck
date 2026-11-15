-- GROUPS-1 Part B: READ-ONLY merge readiness checks.
-- Execute after review mappings have been populated in a staging environment.
-- Returns a row for each reviewed alias with blockers. No mutations.
with mapping as (
 select r.team_id, r.canonical_team_id, r.reviewed_by, r.reviewed_at, r.evidence,
        a.name alias_name, a.country alias_country, a.basketball_type alias_side,
        c.name canonical_name, c.country canonical_country, c.basketball_type canonical_side,
        ga.created_at alias_group_created, gc.created_at canonical_group_created
 from public.hoopgroup_club_identity_review r
 join public.teams a on a.id=r.team_id
 join public.teams c on c.id=r.canonical_team_id
 left join public.team_fan_groups ga on ga.team_id=r.team_id
 left join public.team_fan_groups gc on gc.team_id=r.canonical_team_id
)
select m.team_id as retired_team_id, m.canonical_team_id,
       m.alias_name, m.canonical_name,
       (m.alias_country is distinct from m.canonical_country) as country_mismatch,
       (m.alias_side is distinct from m.canonical_side) as side_mismatch,
       (m.alias_group_created is null or m.canonical_group_created is null) as missing_group,
       (m.alias_group_created < m.canonical_group_created) as survivor_not_oldest,
       exists(select 1 from public.hoopgroup_club_identity_review r2
              where r2.team_id=m.canonical_team_id) as chained_mapping,
       (select count(*) from public.team_fan_group_members x where x.team_id=m.team_id) as members_to_reparent,
       (select count(*) from public.team_fan_group_posts x where x.team_id=m.team_id) as posts_to_reparent,
       (select count(*) from public.team_fan_group_moderators x where x.team_id=m.team_id) as moderators_to_reparent,
       (select count(*) from public.team_fan_group_reports x where x.team_id=m.team_id) as reports_to_reparent,
       (select count(*) from public.team_fan_group_join_requests x where x.team_id=m.team_id) as requests_to_reparent
from mapping m
order by m.canonical_name,m.alias_name,m.team_id;

-- Merge execution MUST reject any row with country/side mismatch,
-- missing groups, chained mappings or survivor_not_oldest, unless an
-- explicit reviewed exception is documented. Preserve original UUID
-- routes via redirects, storage paths and all foreign-key relationships.
