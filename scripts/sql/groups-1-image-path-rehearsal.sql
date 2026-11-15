-- GROUPS-1: rollback-only private image path rehearsal.
-- Models object-key relocation and post reference updates without touching storage.objects.
-- This DOES NOT test Supabase Storage API moves, RLS or signed URL issuance.
begin;
create temporary table hc_image_objects(name text primary key) on commit drop;
create temporary table hc_image_posts(id integer primary key,team_id uuid not null,image_url text) on commit drop;
create temporary table hc_image_redirects(retired_team_id uuid primary key,survivor_team_id uuid not null) on commit drop;
insert into hc_image_redirects values
 ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001');
insert into hc_image_objects values
 ('00000000-0000-4000-8000-000000000002/a.jpg'),
 ('00000000-0000-4000-8000-000000000002/sub/b.png');
insert into hc_image_posts values
 (1,'00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002/a.jpg'),
 (2,'00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002/sub/b.png');
do $$
declare n integer;
begin
 select count(*) into n from hc_image_objects o join hc_image_redirects d on split_part(o.name,'/',1)=d.retired_team_id::text;
 if n<>2 then raise exception 'Expected two objects requiring migration'; end if;
 -- Missing destination or a post pointing to an old key must fail the gate.
 select count(*) into n from hc_image_posts p where not exists(select 1 from hc_image_objects o where o.name=p.image_url);
 if n<>0 then raise exception 'Unexpected initial missing image object'; end if;
 update hc_image_objects o
 set name=d.survivor_team_id::text || substr(o.name,length(d.retired_team_id::text)+1)
 from hc_image_redirects d where split_part(o.name,'/',1)=d.retired_team_id::text;
 select count(*) into n from hc_image_posts p where not exists(select 1 from hc_image_objects o where o.name=p.image_url);
 if n<>2 then raise exception 'Expected stale post image references after moving objects'; end if;
 update hc_image_posts p
 set image_url=d.survivor_team_id::text || substr(p.image_url,length(d.retired_team_id::text)+1),
     team_id=d.survivor_team_id
 from hc_image_redirects d where p.team_id=d.retired_team_id;
 select count(*) into n from hc_image_posts p where not exists(select 1 from hc_image_objects o where o.name=p.image_url);
 if n<>0 then raise exception 'Post image references not preserved'; end if;
 select count(*) into n from hc_image_objects o join hc_image_redirects d on split_part(o.name,'/',1)=d.retired_team_id::text;
 if n<>0 then raise exception 'Retired image keys remain'; end if;
 raise notice 'GROUPS-1 synthetic private image path rehearsal passed';
end $$;
rollback;
