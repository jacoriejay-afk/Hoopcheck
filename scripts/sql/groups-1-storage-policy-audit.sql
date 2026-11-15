-- GROUPS-1: read-only storage policy baseline.
-- This is a configuration inventory, not a signed URL or RLS authorization test.
select id, public as is_public from storage.buckets where id='fan-group-images';
select policyname,cmd,roles,qual
from pg_policies
where schemaname='storage' and tablename='objects'
  and policyname='fan group members read group images';
-- Expected: bucket is private, SELECT policy restricted to authenticated,
-- and predicate checks the first storage folder UUID using
-- public.is_team_fan_group_member. A real merge must relocate object keys
-- and update post.image_url; never just rewrite group redirects.
