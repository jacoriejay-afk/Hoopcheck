-- GROUPS-1 staging: fail-closed collision gate before any canonical merge.
-- READ ONLY. Run after human-reviewed mappings and identity assertions.
-- A passing result does NOT authorize merging: image paths and route redirects
-- must also be tested in the isolated rehearsal environment.
do $$
declare
  n bigint;
begin
  if to_regclass('public.hoopgroup_club_identity_review') is null then
    raise exception 'GROUPS-1: reviewed identity table missing';
  end if;

  select count(*) into n from public.hoopgroup_club_identity_review;
  if n=0 then raise exception 'GROUPS-1: no reviewed canonical mappings; merge gate cannot pass vacuously'; end if;

  select count(*) into n
  from public.hoopgroup_club_identity_review r
  where exists (
    select 1 from public.team_fan_group_members a
    join public.team_fan_group_members b
      on b.team_id=r.canonical_team_id and b.user_id=a.user_id
    where a.team_id=r.team_id
  );
  if n>0 then raise exception 'GROUPS-1: % reviewed pairs have overlapping memberships',n; end if;

  select count(*) into n
  from public.hoopgroup_club_identity_review r
  where exists (
    select 1 from public.team_fan_group_moderators a
    join public.team_fan_group_moderators b
      on b.team_id=r.canonical_team_id and b.user_id=a.user_id
    where a.team_id=r.team_id and a.user_id is not null
  );
  if n>0 then raise exception 'GROUPS-1: % reviewed pairs have duplicate named moderators',n; end if;

  select count(*) into n
  from public.hoopgroup_club_identity_review r
  where exists (
    select 1 from public.team_fan_group_join_requests a
    join public.team_fan_group_join_requests b
      on b.team_id=r.canonical_team_id and b.user_id=a.user_id and b.status='pending'
    where a.team_id=r.team_id and a.status='pending'
  );
  if n>0 then raise exception 'GROUPS-1: % reviewed pairs have duplicate pending requests',n; end if;

  select count(*) into n
  from public.hoopgroup_club_identity_review r
  where exists (
    select 1 from public.team_fan_group_posts a
    join public.team_fan_group_posts b
      on b.team_id=r.canonical_team_id and b.is_pinned and b.status='published'
    where a.team_id=r.team_id and a.is_pinned and a.status='published'
  );
  if n>0 then raise exception 'GROUPS-1: % reviewed pairs have conflicting pinned posts',n; end if;

  select count(*) into n
  from public.hoopgroup_club_identity_review r
  where exists (
    select 1 from public.team_fan_group_moderators a
    join public.team_fan_group_moderators b
      on b.team_id=r.canonical_team_id and b.moderator_type='platform'
    where a.team_id=r.team_id and a.moderator_type='platform'
  );
  if n>0 then raise exception 'GROUPS-1: % reviewed pairs have conflicting platform moderators',n; end if;

  select count(*) into n
  from public.hoopgroup_club_identity_review r
  join public.team_fan_group_reports x on x.team_id=r.team_id
  join public.team_fan_group_posts p on p.id=x.post_id
  where p.team_id<>x.team_id;
  if n>0 then raise exception 'GROUPS-1: % reports have inconsistent post group IDs',n; end if;

  select count(*) into n
  from public.hoopgroup_club_identity_review r
  join storage.objects o on o.bucket_id='fan-group-images'
    and split_part(o.name,'/',1)=r.team_id::text;
  if n>0 then raise exception 'GROUPS-1: % private image objects require verified path migration',n; end if;

  -- Pairwise alias-vs-survivor checks alone miss conflicts between two
  -- aliases mapped to the same canonical group.
  select count(*) into n
  from public.hoopgroup_club_identity_review a
  join public.hoopgroup_club_identity_review b
    on b.canonical_team_id=a.canonical_team_id and b.team_id>a.team_id
  join public.team_fan_group_members am on am.team_id=a.team_id
  join public.team_fan_group_members bm on bm.team_id=b.team_id and bm.user_id=am.user_id;
  if n>0 then raise exception 'GROUPS-1: % cross-alias membership collisions',n; end if;

  select count(*) into n
  from public.hoopgroup_club_identity_review a
  join public.hoopgroup_club_identity_review b
    on b.canonical_team_id=a.canonical_team_id and b.team_id>a.team_id
  join public.team_fan_group_posts ap on ap.team_id=a.team_id and ap.is_pinned and ap.status='published'
  join public.team_fan_group_posts bp on bp.team_id=b.team_id and bp.is_pinned and bp.status='published';
  if n>0 then raise exception 'GROUPS-1: % cross-alias pinned post collisions',n; end if;

  select count(*) into n
  from public.hoopgroup_club_identity_review a
  join public.hoopgroup_club_identity_review b
    on b.canonical_team_id=a.canonical_team_id and b.team_id>a.team_id
  join public.team_fan_group_join_requests aq on aq.team_id=a.team_id and aq.status='pending'
  join public.team_fan_group_join_requests bq on bq.team_id=b.team_id and bq.user_id=aq.user_id and bq.status='pending';
  if n>0 then raise exception 'GROUPS-1: % cross-alias pending request collisions',n; end if;

  select count(*) into n
  from public.hoopgroup_club_identity_review a
  join public.hoopgroup_club_identity_review b
    on b.canonical_team_id=a.canonical_team_id and b.team_id>a.team_id
  join public.team_fan_group_moderators am on am.team_id=a.team_id and am.user_id is not null
  join public.team_fan_group_moderators bm on bm.team_id=b.team_id and bm.user_id=am.user_id;
  if n>0 then raise exception 'GROUPS-1: % cross-alias named moderator collisions',n; end if;

  select count(*) into n
  from public.hoopgroup_club_identity_review a
  join public.hoopgroup_club_identity_review b
    on b.canonical_team_id=a.canonical_team_id and b.team_id>a.team_id
  join public.team_fan_group_moderators am on am.team_id=a.team_id and am.moderator_type='platform'
  join public.team_fan_group_moderators bm on bm.team_id=b.team_id and bm.moderator_type='platform';
  if n>0 then raise exception 'GROUPS-1: % cross-alias platform moderator collisions',n; end if;

  raise notice 'GROUPS-1 collision gate passed; this does not authorize a merge';
end $$;
