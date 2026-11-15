-- GROUPS-1: regression assertions for reviewed canonical-club mappings.
-- READ ONLY: raises on any unsafe mapping. Run on staging after review rows exist.
do $$
declare v_count bigint;
begin
 if to_regclass('public.hoopgroup_club_identity_review') is null then
   raise exception 'GROUPS-1 staging migration not installed';
 end if;
 if to_regclass('public.hoopgroup_retired_group_redirects') is null then
   raise exception 'GROUPS-1 redirects table missing';
 end if;
 select count(*) into v_count from public.hoopgroup_club_identity_review r
 join public.teams a on a.id=r.team_id
 join public.teams c on c.id=r.canonical_team_id
 where lower(trim(a.country)) is distinct from lower(trim(c.country))
    or coalesce(a.basketball_type,'') is distinct from coalesce(c.basketball_type,'');
 if v_count > 0 then raise exception 'Unsafe identity mapping: % country/side mismatches',v_count; end if;
 select count(*) into v_count from public.hoopgroup_club_identity_review r
 where exists(select 1 from public.hoopgroup_club_identity_review next
              where next.team_id=r.canonical_team_id);
 if v_count > 0 then raise exception 'Unsafe identity mapping: % chained mappings',v_count; end if;
 select count(*) into v_count from public.hoopgroup_club_identity_review r
 left join public.team_fan_groups a on a.team_id=r.team_id
 left join public.team_fan_groups c on c.team_id=r.canonical_team_id
 where a.team_id is null or c.team_id is null or a.created_at<c.created_at;
 if v_count > 0 then raise exception 'Unsafe identity mapping: % missing groups or older aliases',v_count; end if;
 select count(*) into v_count
 from public.hoopgroup_retired_group_redirects d
 left join public.hoopgroup_club_identity_review r on r.team_id=d.retired_team_id
 where r.team_id is null or r.canonical_team_id<>d.survivor_team_id;
 if v_count > 0 then raise exception 'Unsafe redirect: % entries do not match reviewed identities',v_count; end if;
 select count(*) into v_count
 from public.hoopgroup_retired_group_redirects d
 where exists(select 1 from public.hoopgroup_retired_group_redirects next
              where next.retired_team_id=d.survivor_team_id);
 if v_count > 0 then raise exception 'Unsafe redirect: % chained redirects',v_count; end if;
 select count(*) into v_count
 from public.hoopgroup_retired_group_redirects d
 left join public.team_fan_groups survivor on survivor.team_id=d.survivor_team_id
 where survivor.team_id is null;
 if v_count > 0 then raise exception 'Unsafe redirect: % missing survivor groups',v_count; end if;
 select count(*) into v_count
 from public.team_fan_group_reports r
 join public.team_fan_group_posts p on p.id=r.post_id
 where r.team_id is distinct from p.team_id;
 if v_count > 0 then raise exception 'Unsafe report linkage: % reports point to posts in other groups',v_count; end if;
 select count(*) into v_count
 from public.hoopgroup_retired_group_redirects d
 join public.team_fan_group_posts p on p.team_id=d.retired_team_id;
 if v_count > 0 then raise exception 'Incomplete retirement: % posts remain on redirected groups',v_count; end if;
 select count(*) into v_count
 from public.hoopgroup_retired_group_redirects d
 join public.team_fan_group_members m on m.team_id=d.retired_team_id;
 if v_count > 0 then raise exception 'Incomplete retirement: % memberships remain on redirected groups',v_count; end if;
 select count(*) into v_count
 from public.hoopgroup_retired_group_redirects d
 join public.team_fan_group_join_requests q on q.team_id=d.retired_team_id;
 if v_count > 0 then raise exception 'Incomplete retirement: % join requests remain on redirected groups',v_count; end if;
 select count(*) into v_count
 from public.hoopgroup_retired_group_redirects d
 join public.team_fan_group_moderators m on m.team_id=d.retired_team_id;
 if v_count > 0 then raise exception 'Incomplete retirement: % moderators remain on redirected groups',v_count; end if;
 select count(*) into v_count
 from public.hoopgroup_retired_group_redirects d
 join public.team_fan_group_reports r on r.team_id=d.retired_team_id;
 if v_count > 0 then raise exception 'Incomplete retirement: % reports remain on redirected groups',v_count; end if;
 select count(*) into v_count
 from public.hoopgroup_retired_group_redirects d
 join storage.objects o on o.bucket_id='fan-group-images'
   and split_part(o.name,'/',1)=d.retired_team_id::text;
 if v_count > 0 then raise exception 'Incomplete retirement: % private images remain on redirected groups',v_count; end if;
 raise notice 'GROUPS-1 identity mapping structural assertions passed';
end $$;

-- Snapshot row counts before/after any future merge. A merge must preserve
-- posts, comments, reports, and all distinct user memberships.
select 'posts' as relation,count(*) as rows from public.team_fan_group_posts
union all select 'comments',count(*) from public.team_fan_group_comments
union all select 'reports',count(*) from public.team_fan_group_reports
union all select 'memberships',count(*) from public.team_fan_group_members
union all select 'moderators',count(*) from public.team_fan_group_moderators
union all select 'join_requests',count(*) from public.team_fan_group_join_requests
union all select 'private_image_objects',count(*) from storage.objects where bucket_id='fan-group-images';
