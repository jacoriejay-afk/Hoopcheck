-- GROUPS-1: read-only integrity baseline; no group merges or writes.
select 'report_post_group_mismatch' as check_name,count(*)::bigint as violations
from public.team_fan_group_reports r join public.team_fan_group_posts p on p.id=r.post_id
where r.team_id is distinct from p.team_id
union all select 'orphan_group_posts',count(*) from public.team_fan_group_posts p left join public.team_fan_groups g on g.team_id=p.team_id where g.team_id is null
union all select 'orphan_memberships',count(*) from public.team_fan_group_members m left join public.team_fan_groups g on g.team_id=m.team_id where g.team_id is null
union all select 'orphan_join_requests',count(*) from public.team_fan_group_join_requests j left join public.team_fan_groups g on g.team_id=j.team_id where g.team_id is null
union all select 'orphan_moderators',count(*) from public.team_fan_group_moderators m left join public.team_fan_groups g on g.team_id=m.team_id where g.team_id is null
union all select 'orphan_reports',count(*) from public.team_fan_group_reports r left join public.team_fan_groups g on g.team_id=r.team_id where g.team_id is null
union all select 'orphan_comments',count(*) from public.team_fan_group_comments c left join public.team_fan_group_posts p on p.id=c.post_id where p.id is null
union all select 'private_image_objects',count(*) from storage.objects where bucket_id='fan-group-images';
select id,public as is_public from storage.buckets where id='fan-group-images';
-- Expected bucket is private; zero objects does not validate future relocation or RLS.
