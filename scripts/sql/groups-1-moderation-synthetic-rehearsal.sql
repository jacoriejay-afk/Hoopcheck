-- GROUPS-1: rollback-only synthetic moderator and join-request rehearsal.
-- Uses temporary tables only. Not a replacement for real-schema RLS tests.
begin;
create temporary table hc_mods(id int primary key,group_id int not null,user_id int,kind text not null) on commit drop;
create unique index hc_one_platform on hc_mods(group_id) where kind='platform';
create unique index hc_one_named_mod on hc_mods(group_id,user_id) where user_id is not null;
create temporary table hc_requests(id int primary key,group_id int not null,user_id int not null,status text not null) on commit drop;
create unique index hc_one_pending on hc_requests(group_id,user_id) where status='pending';
insert into hc_mods values (1,1,null,'platform'),(2,2,null,'platform'),(3,2,50,'club_admin'),(4,1,60,'fan_co_moderator'),(5,2,60,'fan_co_moderator');
insert into hc_requests values (10,1,70,'pending'),(11,2,70,'pending'),(12,2,80,'pending'),(13,2,90,'approved');
do $$
declare n bigint;
begin
  -- Simulate explicit collision resolution: keep the survivor platform moderator,
  -- preserve the alias club admin and nonduplicate co-moderators.
  delete from hc_mods where group_id=2 and kind='platform';
  delete from hc_mods a where a.group_id=2 and a.user_id is not null
    and exists(select 1 from hc_mods b where b.group_id=1 and b.user_id=a.user_id);
  update hc_mods set group_id=1 where group_id=2;

  -- Preserve one pending request per user, and retain historical decisions.
  update hc_requests set status='cancelled' where id=11;
  update hc_requests set group_id=1 where group_id=2;

  select count(*) into n from hc_mods where group_id=1;
  if n<>3 then raise exception 'Expected 3 distinct moderators, got %',n; end if;
  select count(*) into n from hc_mods where group_id=1 and kind='club_admin' and user_id=50;
  if n<>1 then raise exception 'Club administrator lost'; end if;
  select count(*) into n from hc_requests where group_id=1;
  if n<>4 then raise exception 'Join-request history lost'; end if;
  select count(*) into n from hc_requests where group_id=1 and status='pending';
  if n<>2 then raise exception 'Pending-request dedup failed'; end if;
  raise notice 'GROUPS-1 moderator/request synthetic rehearsal passed';
end $$;
rollback;
-- The duplicate co-moderator row and redundant platform role are intentionally
-- discarded only in this synthetic model. Real merge requires explicit audit
-- decisions and historical traceability, plus tested RLS and storage access.
