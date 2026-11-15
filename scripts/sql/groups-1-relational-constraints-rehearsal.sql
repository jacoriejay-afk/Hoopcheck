-- GROUPS-1: rollback-only relational constraint rehearsal.
-- Uses temporary tables with real PostgreSQL FK and uniqueness behavior.
-- No application tables or production records are touched.
begin;
create temporary table hc_clubs(id integer primary key) on commit drop;
create temporary table hc_groups(team_id integer primary key references hc_clubs(id)) on commit drop;
create temporary table hc_posts(id integer primary key,team_id integer not null references hc_groups(team_id),is_pinned boolean not null,status text not null) on commit drop;
create unique index hc_one_pinned on hc_posts(team_id) where is_pinned and status='published';
create temporary table hc_comments(id integer primary key,post_id integer not null references hc_posts(id)) on commit drop;
create temporary table hc_reports(id integer primary key,team_id integer not null references hc_groups(team_id),post_id integer not null references hc_posts(id)) on commit drop;
insert into hc_clubs values (1),(2);
insert into hc_groups values (1),(2);
insert into hc_posts values (10,1,true,'published'),(20,2,true,'published'),(21,2,false,'published');
insert into hc_comments values (30,20);
insert into hc_reports values (40,2,20);
do $$
declare rejected boolean:=false;
begin
  -- A direct move MUST fail while both groups have a pinned post.
  begin
    update hc_posts set team_id=1 where id=20;
  exception when unique_violation then rejected:=true;
  end;
  if not rejected then raise exception 'Expected pinned-post unique index to reject direct move'; end if;

  -- Resolve the collision explicitly, preserve original post UUIDs, and
  -- reparent report references before retiring the alias group.
  update hc_posts set is_pinned=false where id=20;
  update hc_posts set team_id=1 where team_id=2;
  update hc_reports set team_id=1 where team_id=2;
  delete from hc_groups where team_id=2;

  if (select count(*) from hc_posts where team_id=1)<>3
     or (select count(*) from hc_comments c join hc_posts p on p.id=c.post_id where p.team_id=1)<>1
     or (select count(*) from hc_reports r join hc_posts p on p.id=r.post_id where r.team_id=p.team_id and r.team_id=1)<>1
     or (select count(*) from hc_posts where team_id=1 and is_pinned)<>1
  then raise exception 'Relational preservation assertions failed'; end if;
  raise notice 'GROUPS-1 relational FK and pinned uniqueness rehearsal passed';
end $$;
rollback;
-- Does not validate application RLS, UUID routes, storage, or production schema.
