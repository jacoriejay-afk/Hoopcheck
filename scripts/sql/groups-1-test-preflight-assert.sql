-- GROUPS-1 isolated rehearsal: fail-closed prerequisite assertion.
-- READ ONLY. Raises if the project is not suitable for merge tests.
do $$
declare
  missing text;
begin
  select string_agg(format('%I.%I',s.schema_name,s.relation_name),', ' order by s.relation_name)
  into missing
  from (values
    ('public','teams'),
    ('public','profiles'),
    ('public','team_fan_groups'),
    ('public','team_fan_group_moderators'),
    ('public','team_fan_group_members'),
    ('public','team_fan_group_join_requests'),
    ('public','team_fan_group_posts'),
    ('public','team_fan_group_comments'),
    ('public','team_fan_group_reports'),
    ('public','hoopgroup_club_identity_review'),
    ('public','hoopgroup_retired_group_redirects')
  ) as s(schema_name,relation_name)
  where to_regclass(format('%I.%I',s.schema_name,s.relation_name)) is null;

  if missing is not null then
    raise exception 'GROUPS-1 rehearsal blocked: missing tables: %',missing;
  end if;
  if not exists(select 1 from storage.buckets where id='fan-group-images' and public=false) then
    raise exception 'GROUPS-1 rehearsal blocked: private fan-group-images bucket missing or public';
  end if;
  raise notice 'GROUPS-1 rehearsal prerequisites present; preservation tests still required';
end $$;
