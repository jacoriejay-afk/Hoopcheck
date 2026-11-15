-- GROUPS-1: isolated, rollback-only collision fixture.
-- Can run on a partially initialized test project because it uses pg_temp tables.
-- NO production tables, user records, or storage objects are touched.
begin;
create temporary table hc_groups(id int primary key, name text) on commit drop;
create temporary table hc_members(group_id int, user_id int, primary key(group_id,user_id)) on commit drop;
create temporary table hc_posts(id int primary key,group_id int not null,is_pinned boolean not null) on commit drop;
create temporary table hc_comments(id int primary key,post_id int not null) on commit drop;
create temporary table hc_reports(id int primary key,group_id int not null,post_id int not null) on commit drop;
insert into hc_groups values (1,'Survivor'),(2,'Alias');
insert into hc_members values (1,10),(2,10),(2,20);
insert into hc_posts values (100,1,true),(200,2,true),(201,2,false);
insert into hc_comments values (300,200);
insert into hc_reports values (400,2,200);
do $$
declare n bigint;
begin
  -- Confirm the fixture actually exercises both uniqueness collisions.
  select count(*) into n from hc_members a join hc_members b on a.user_id=b.user_id
    where a.group_id=1 and b.group_id=2;
  if n<>1 then raise exception 'Fixture missing membership collision'; end if;
  select count(*) into n from hc_posts where is_pinned;
  if n<>2 then raise exception 'Fixture missing pinned-post collision'; end if;

  -- Simulate non-destructive consolidation, not a live group merge.
  update hc_posts set is_pinned=false where group_id=2 and is_pinned;
  insert into hc_members(group_id,user_id)
    select 1,user_id from hc_members where group_id=2
    on conflict do nothing;
  update hc_posts set group_id=1 where group_id=2;
  update hc_reports set group_id=1 where group_id=2;

  if (select count(*) from hc_members where group_id=1)<>2 then
    raise exception 'Distinct memberships not preserved'; end if;
  if (select count(*) from hc_posts where group_id=1)<>3 then
    raise exception 'Posts not preserved'; end if;
  if (select count(*) from hc_comments c join hc_posts p on p.id=c.post_id where p.group_id=1)<>1 then
    raise exception 'Comment association not preserved'; end if;
  if (select count(*) from hc_reports r join hc_posts p on p.id=r.post_id
      where r.group_id=p.group_id and r.group_id=1)<>1 then
    raise exception 'Report consistency not preserved'; end if;
  if (select count(*) from hc_posts where group_id=1 and is_pinned)<>1 then
    raise exception 'Pinned-post uniqueness not preserved'; end if;
  raise notice 'GROUPS-1 synthetic membership/post/comment/report collision rehearsal passed';
end $$;
rollback;
-- This intentionally does not test actual RLS, redirects, moderators, storage,
-- real foreign keys, or production migration. Those require full staging schema.
