-- GROUPS-1: READ-ONLY prerequisite inventory for a dedicated rehearsal project.
-- Safe on empty or partially initialized Supabase projects; no table data copied.
-- Do not install GROUPS-1 on a project missing these prerequisites.
with prerequisites(schema_name,relation_name,purpose) as (
 values
 ('public','teams','canonical club records'),
 ('public','profiles','account foreign keys'),
 ('public','team_fan_groups','FAN-GRP-1 group identity'),
 ('public','team_fan_group_moderators','moderation preservation'),
 ('public','team_fan_group_members','membership preservation'),
 ('public','team_fan_group_join_requests','pending requests'),
 ('public','team_fan_group_posts','post preservation'),
 ('public','team_fan_group_comments','comment preservation'),
 ('public','team_fan_group_reports','report preservation'),
 ('public','hoopgroup_club_identity_review','GROUPS-1 reviewed mappings'),
 ('public','hoopgroup_retired_group_redirects','GROUPS-1 old-route redirects')
)
select schema_name||'.'||relation_name as relation,
       case when to_regclass(format('%I.%I',schema_name,relation_name)) is null
         then 'MISSING' else 'PRESENT' end as status,
       purpose
from prerequisites
order by relation_name;

-- Check the dedicated private-image bucket independently of table availability.
select case when exists(select 1 from storage.buckets where id='fan-group-images')
  then 'PRESENT' else 'MISSING' end as fan_group_images_bucket;

-- A missing prerequisite means STOP: build an isolated, version-matched
-- baseline using migrations and synthetic data. Never restore production
-- authentication records, payment details, or private image objects.
