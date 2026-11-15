-- GROUPS-1: rollback-only cross-alias collision regression.
-- Three groups, two aliases mapping to one survivor. No application tables.
begin;
create temporary table hc_review(alias_id integer primary key, canonical_id integer not null) on commit drop;
create temporary table hc_members(team_id integer,user_id integer,primary key(team_id,user_id)) on commit drop;
create temporary table hc_posts(team_id integer,is_pinned boolean,status text) on commit drop;
create temporary table hc_requests(team_id integer,user_id integer,status text) on commit drop;
create temporary table hc_moderators(team_id integer,user_id integer,moderator_type text) on commit drop;
insert into hc_review values (2,1),(3,1);
insert into hc_members values (2,100),(3,100);
insert into hc_posts values (2,true,'published'),(3,true,'published');
insert into hc_requests values (2,200,'pending'),(3,200,'pending');
insert into hc_moderators values (2,300,'club_admin'),(3,300,'club_admin'),(2,null,'platform'),(3,null,'platform');
do $$
declare n bigint;
begin
 select count(*) into n from hc_review a join hc_review b on b.canonical_id=a.canonical_id and b.alias_id>a.alias_id join hc_members am on am.team_id=a.alias_id join hc_members bm on bm.team_id=b.alias_id and bm.user_id=am.user_id;
 if n<>1 then raise exception 'Cross-alias membership detection failed: %',n; end if;
 select count(*) into n from hc_review a join hc_review b on b.canonical_id=a.canonical_id and b.alias_id>a.alias_id join hc_posts ap on ap.team_id=a.alias_id and ap.is_pinned and ap.status='published' join hc_posts bp on bp.team_id=b.alias_id and bp.is_pinned and bp.status='published';
 if n<>1 then raise exception 'Cross-alias pinned detection failed: %',n; end if;
 select count(*) into n from hc_review a join hc_review b on b.canonical_id=a.canonical_id and b.alias_id>a.alias_id join hc_requests aq on aq.team_id=a.alias_id and aq.status='pending' join hc_requests bq on bq.team_id=b.alias_id and bq.user_id=aq.user_id and bq.status='pending';
 if n<>1 then raise exception 'Cross-alias pending detection failed: %',n; end if;
 select count(*) into n from hc_review a join hc_review b on b.canonical_id=a.canonical_id and b.alias_id>a.alias_id join hc_moderators am on am.team_id=a.alias_id and am.user_id is not null join hc_moderators bm on bm.team_id=b.alias_id and bm.user_id=am.user_id;
 if n<>1 then raise exception 'Cross-alias named moderator detection failed: %',n; end if;
 select count(*) into n from hc_review a join hc_review b on b.canonical_id=a.canonical_id and b.alias_id>a.alias_id join hc_moderators am on am.team_id=a.alias_id and am.moderator_type='platform' join hc_moderators bm on bm.team_id=b.alias_id and bm.moderator_type='platform';
 if n<>1 then raise exception 'Cross-alias platform moderator detection failed: %',n; end if;
 raise notice 'GROUPS-1 five cross-alias collisions detected as expected';
end $$;
rollback;
