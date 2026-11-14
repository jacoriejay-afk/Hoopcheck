\set ON_ERROR_STOP on
begin;
create schema if not exists auth;
create schema if not exists private;
create role anon;
create role authenticated;
grant usage on schema auth, private to authenticated;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function public.can_use_unified_hoopfeed() returns boolean language sql stable as
$$ select current_setting('test.feed_paid', true) = 'yes' $$;
create function public.is_current_user_admin_or_moderator() returns boolean language sql stable as $$ select false $$;
create table auth.users (id uuid primary key);
create table public.profiles (id uuid primary key, account_type text, profile_visibility text);
create table public.teams (id uuid primary key);
create table public.leagues (id uuid primary key);
create table public.womens_teams (id uuid primary key);
create table public.womens_leagues (id uuid primary key);
create table public.follow_relationships (follower_id uuid, target_type text, target_id uuid, unique(follower_id,target_type,target_id));
create table public.feed_posts (id uuid primary key, shared_post_id uuid, author_id uuid, status text, expires_at timestamptz, created_at timestamptz default now());
create table public.feed_post_checks (post_id uuid, user_id uuid);
create table public.feed_poll_votes (post_id uuid, user_id uuid, option_index integer);
alter table public.feed_posts enable row level security;
alter table public.feed_post_checks enable row level security;
alter table public.feed_poll_votes enable row level security;
grant select on public.feed_posts, public.feed_post_checks, public.feed_poll_votes to authenticated;
create policy "unified hoopfeed approved posts read" on public.feed_posts for select to authenticated using (false);
create policy checks_visible on public.feed_post_checks for select to authenticated
using (exists (select 1 from public.feed_posts p where p.id = post_id));
create policy votes_visible on public.feed_poll_votes for select to authenticated
using (exists (select 1 from public.feed_posts p where p.id = post_id));

\i supabase/migrations/20261113182500_hoopfeed_follower_only_read_rls.sql
\i supabase/migrations/20261114130000_hoopfeed_organization.sql

insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'), ('00000000-0000-0000-0000-000000000003');
insert into profiles values
('00000000-0000-0000-0000-000000000001','player','public'),
('00000000-0000-0000-0000-000000000002','player','public'),
('00000000-0000-0000-0000-000000000003','player','private');
insert into teams values ('20000000-0000-0000-0000-000000000001');
insert into feed_posts(id,author_id,status,community_visible,club_id) values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','approved',true,'20000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','approved',false,null),
('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','approved',true,null),
('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','approved',true,null);
update feed_posts set shared_post_id='10000000-0000-0000-0000-000000000002' where id='10000000-0000-0000-0000-000000000004';
insert into feed_post_checks values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003');
insert into feed_poll_votes select post_id,user_id,0 from feed_post_checks;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select set_config('test.feed_paid','yes',true);
do $$
declare ids uuid[] := array['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[];
begin
  if (select count(*) from feed_posts) <> 1 or (select count(*) from feed_posts where club_id is not null) <> 1 then
    raise exception 'Community tag or private source boundary failed';
  end if;
  if (select count(*) from public.get_hoopfeed_check_totals(ids) where checks_count=2 and checked_by_me) <> 1
    or (select count(*) from public.get_hoopfeed_check_totals(ids)) <> 1 then
    raise exception 'Check totals did not respect visibility';
  end if;
  if (select count(*) from public.get_hoopfeed_poll_totals(ids) where votes_count=2 and voted_by_me) <> 1
    or (select count(*) from public.get_hoopfeed_poll_totals(ids)) <> 1 then
    raise exception 'Poll totals did not respect visibility';
  end if;
end $$;
select set_config('test.feed_paid','no',true);
do $$ begin
  if exists (select 1 from feed_posts) then raise exception 'Free member saw feed posts'; end if;
end $$;
reset role;

insert into follow_relationships values ('00000000-0000-0000-0000-000000000001','player','00000000-0000-0000-0000-000000000002');
set role authenticated;
select set_config('test.feed_paid','yes',true);
do $$ begin
  if (select count(*) from feed_posts) <> 3 then raise exception 'Follower visibility failed'; end if;
end $$;
reset role;

insert into user_blocks values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
set role authenticated;
do $$ begin
  if exists (select 1 from feed_posts) then raise exception 'Reverse block failed'; end if;
end $$;
reset role;

do $$ begin
  begin
    insert into follow_relationships values ('00000000-0000-0000-0000-000000000001','player','00000000-0000-0000-0000-000000000001');
    raise exception 'Self-follow accepted';
  exception when check_violation then null;
  end;
end $$;
rollback;
