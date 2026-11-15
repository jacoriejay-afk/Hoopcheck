-- GROUPS-1: staging-only merge collision audit, read-only.
-- Review mappings are required. Do not infer them from names.
with reviewed as (
 select r.team_id as alias_id,r.canonical_team_id as survivor_id
 from public.hoopgroup_club_identity_review r
), collisions as (
 select r.alias_id,r.survivor_id,
   (select count(*) from public.team_fan_group_members a join public.team_fan_group_members b
     on b.team_id=r.survivor_id and b.user_id=a.user_id where a.team_id=r.alias_id) member_collisions,
   (select count(*) from public.team_fan_group_moderators a join public.team_fan_group_moderators b
     on b.team_id=r.survivor_id and b.user_id=a.user_id where a.team_id=r.alias_id and a.user_id is not null) moderator_collisions,
   (select count(*) from public.team_fan_group_join_requests a join public.team_fan_group_join_requests b
     on b.team_id=r.survivor_id and b.user_id=a.user_id and b.status='pending'
     where a.team_id=r.alias_id and a.status='pending') pending_request_collisions,
   (select count(*) from public.team_fan_group_posts p
     where p.team_id=r.alias_id and p.is_pinned and p.status='published') alias_pinned_posts,
   (select count(*) from public.team_fan_group_posts p
     where p.team_id=r.survivor_id and p.is_pinned and p.status='published') survivor_pinned_posts,
   (select count(*) from public.team_fan_group_moderators m
     where m.team_id=r.alias_id and m.moderator_type='platform') alias_platform_moderators,
   (select count(*) from public.team_fan_group_moderators m
     where m.team_id=r.survivor_id and m.moderator_type='platform') survivor_platform_moderators,
   (select count(*) from public.team_fan_group_reports x
     where x.team_id=r.alias_id) reports_to_preserve,
   (select count(*) from public.team_fan_group_comments x join public.team_fan_group_posts p on p.id=x.post_id
     where p.team_id=r.alias_id) comments_to_preserve,
   (select count(*) from public.team_fan_group_posts p
     where p.team_id=r.alias_id and p.image_url is not null) image_posts_to_preserve,
   (select count(*) from storage.objects o
     where o.bucket_id='fan-group-images' and split_part(o.name,'/',1)=r.alias_id::text) private_objects_under_alias,
   (select count(*) from public.team_fan_group_reports x join public.team_fan_group_posts p on p.id=x.post_id
     where x.team_id=r.alias_id and p.team_id<>x.team_id) mismatched_report_team_ids
 from reviewed r
)
select *, (alias_pinned_posts>0 and survivor_pinned_posts>0) as pinned_conflict,
 (alias_platform_moderators>0 and survivor_platform_moderators>0) as platform_moderator_conflict,
 (mismatched_report_team_ids>0) as inconsistent_report_link
from collisions order by alias_id;

-- Group-image storage paths are keyed by the original team UUID. A merge must
-- retain access to old paths or migrate objects with verified signed-URL and
-- storage-policy behavior. Never delete the alias group until this is solved.
-- Existing group-post comments refer to post UUIDs, so moving a post must
-- preserve its ID. Reports also contain team_id AND post_id and must stay
-- consistent after a move.
