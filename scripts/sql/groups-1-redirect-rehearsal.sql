-- GROUPS-1: rollback-only route redirect integrity rehearsal.
-- Tests reviewed identity matching, missing survivors and chained redirects.
-- No application tables, production records, or routes are changed.
begin;
create temporary table hc_groups(id integer primary key) on commit drop;
create temporary table hc_review(alias_id integer primary key,canonical_id integer not null) on commit drop;
create temporary table hc_redirects(retired_id integer primary key,survivor_id integer not null) on commit drop;
insert into hc_groups values(1),(2),(3);
insert into hc_review values(2,1),(3,1);
insert into hc_redirects values(2,1),(3,1);
do $$
declare n bigint;
begin
 select count(*) into n from hc_redirects d left join hc_review r on r.alias_id=d.retired_id where r.alias_id is null or r.canonical_id<>d.survivor_id;
 if n<>0 then raise exception 'Expected reviewed redirects to match'; end if;
 select count(*) into n from hc_redirects d join hc_redirects next on next.retired_id=d.survivor_id;
 if n<>0 then raise exception 'Expected no chained redirects'; end if;
 select count(*) into n from hc_redirects d left join hc_groups g on g.id=d.survivor_id where g.id is null;
 if n<>0 then raise exception 'Expected existing survivors'; end if;
 update hc_redirects set survivor_id=3 where retired_id=2;
 select count(*) into n from hc_redirects d join hc_redirects next on next.retired_id=d.survivor_id;
 if n<>1 then raise exception 'Chained redirect regression not detected'; end if;
 select count(*) into n from hc_redirects d left join hc_review r on r.alias_id=d.retired_id where r.alias_id is null or r.canonical_id<>d.survivor_id;
 if n<>1 then raise exception 'Review mismatch regression not detected'; end if;
 update hc_redirects set survivor_id=99 where retired_id=2;
 select count(*) into n from hc_redirects d left join hc_groups g on g.id=d.survivor_id where g.id is null;
 if n<>1 then raise exception 'Missing survivor regression not detected'; end if;
 raise notice 'GROUPS-1 route redirect regression passed';
end $$;
rollback;
