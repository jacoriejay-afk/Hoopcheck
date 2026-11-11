-- Isolated PostgreSQL RLS policy smoke test (synthetic schema, not full Supabase integration).
\set ON_ERROR_STOP on
create role authenticated nologin;
create schema auth;
create table public.profiles(id uuid primary key);
create table public.feed_posts(
 id uuid primary key, author_id uuid not null, status text not null,
 post_kind text not null, poll_options jsonb, expires_at timestamptz not null
);
create table public.feed_poll_votes(
 post_id uuid references public.feed_posts(id), user_id uuid references public.profiles(id),
 option_index integer not null, primary key(post_id,user_id)
);
create table public.feed_post_bookmarks(
 post_id uuid references public.feed_posts(id), user_id uuid references public.profiles(id),
 primary key(post_id,user_id)
);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
-- Test-only visibility fixture: own posts and same-country/following entitlement are represented
-- by a session-controlled allowed author. NOT a replacement for real Supabase visibility logic.
create function public.can_view_player_feed_post(p_author_id uuid) returns boolean
language sql stable as
$$ select p_author_id = auth.uid() or p_author_id =
nullif(current_setting('test.allowed_author',true),'')::uuid $$;
alter table public.feed_posts enable row level security;
create policy "player experience feed read" on public.feed_posts for select to authenticated
using (expires_at > now() and can_view_player_feed_post(author_id));
alter table public.feed_poll_votes enable row level security;
alter table public.feed_post_bookmarks enable row level security;
create policy "feed poll votes delete own" on public.feed_poll_votes for delete to authenticated using(user_id=auth.uid());
create policy "feed bookmarks read own" on public.feed_post_bookmarks for select to authenticated using(user_id=auth.uid());
create policy "feed bookmarks delete own" on public.feed_post_bookmarks for delete to authenticated using(user_id=auth.uid());
grant usage on schema public,auth to authenticated;
grant select on public.feed_posts to authenticated;
grant select,insert,update,delete on public.feed_poll_votes,public.feed_post_bookmarks to authenticated;
grant execute on function auth.uid(),public.can_view_player_feed_post(uuid) to authenticated;
insert into public.profiles values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
insert into public.feed_posts values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','approved','poll','["A","B"]',now()+interval '1 day'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','approved','poll','{}',now()+interval '1 day'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','approved','poll','["A"]',now()-interval '1 day'),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','pending','poll','["A"]',now()+interval '1 day'),
 ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','approved','discussion',null,now()+interval '1 day');
\i supabase/migrations/20261111000100_secure_feed_poll_votes.sql
\i supabase/migrations/20261111000200_secure_feed_bookmarks.sql
\i supabase/tests/verify_feed_poll_vote_policies.sql
\i supabase/tests/verify_feed_bookmark_policies.sql
-- Seed another user's rows as the test administrator to exercise ownership RLS.
insert into public.feed_poll_votes(post_id,user_id,option_index) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',0);
insert into public.feed_post_bookmarks(post_id,user_id) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('test.allowed_author','00000000-0000-0000-0000-000000000002',false);
insert into public.feed_poll_votes(post_id,user_id,option_index) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',1);
do $$ begin
 if (select count(*) from public.feed_poll_votes) <> 2 then raise exception 'Visible vote missing'; end if;
end $$;
-- Other users' votes are readable on a visible poll but cannot be modified.
do $ownership_check$ declare n integer;
begin
 update public.feed_poll_votes set option_index=1
 where user_id='00000000-0000-0000-0000-000000000002';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'Modified another user vote'; end if;
 delete from public.feed_poll_votes where user_id='00000000-0000-0000-0000-000000000002';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'Deleted another user vote'; end if;
 delete from public.feed_post_bookmarks where user_id='00000000-0000-0000-0000-000000000002';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'Deleted another user bookmark'; end if;
end $ownership_check$;
-- Negative cases: each operation must be denied by RLS, not accepted.
create function pg_temp.expect_denied(q text) returns void language plpgsql as $$
begin
 execute q;
 raise exception 'Unexpectedly permitted: %',q;
exception when insufficient_privilege or check_violation then
 return;
end $$;
select pg_temp.expect_denied($q$insert into public.feed_poll_votes values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',0)$q$);
select pg_temp.expect_denied($q$insert into public.feed_poll_votes values ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',0)$q$);
select pg_temp.expect_denied($q$update public.feed_poll_votes set option_index=5 where user_id=auth.uid()$q$);
select pg_temp.expect_denied($q$insert into public.feed_poll_votes values ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001',0)$q$);
select pg_temp.expect_denied($q$insert into public.feed_poll_votes values ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001',0)$q$);
select pg_temp.expect_denied($q$insert into public.feed_post_bookmarks values ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001')$q$);
select pg_temp.expect_denied($q$insert into public.feed_post_bookmarks values ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001')$q$);
-- Positive bookmark and ownership tests under the authenticated role.
insert into public.feed_post_bookmarks(post_id,user_id) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
do $bookmark_check$ begin
 if (select count(*) from public.feed_post_bookmarks) <> 1 then raise exception 'Own bookmark missing'; end if;
end $bookmark_check$;
-- Bookmarks do not depend on whether poll options are valid.
insert into public.feed_post_bookmarks values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
select pg_temp.expect_denied($q$insert into public.feed_post_bookmarks values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')$q$);
select pg_temp.expect_denied($q$insert into public.feed_poll_votes values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',0)$q$);

select set_config('test.allowed_author','',false);
do $$ begin
 if (select count(*) from public.feed_poll_votes) <> 0 then raise exception 'Hidden vote leaked'; end if;
 if (select count(*) from public.feed_post_bookmarks) <> 2 then raise exception 'Own bookmarks not visible'; end if;
end $$;

-- Visibility matrix: reproduce the current production SQL authorization logic.
-- Synthetic role/subscription data only; this is NOT authenticated Supabase integration.
reset role;
alter table public.profiles add column account_type text;
alter table public.profiles add column current_country text;
update public.profiles set account_type='player',current_country='Azerbaijan';
create table public.subscriptions(user_id uuid,plan text,status text,access_status text);
create table public.follow_relationships(follower_id uuid,target_type text,target_id uuid);
create table public.admin_roles(user_id uuid,role text);
insert into public.follow_relationships values
 ('00000000-0000-0000-0000-000000000001','player','00000000-0000-0000-0000-000000000002');
insert into public.subscriptions values
 ('00000000-0000-0000-0000-000000000001','pro','active','active');
grant select on public.profiles,public.subscriptions,public.follow_relationships,public.admin_roles to authenticated;
create function public.is_current_user_admin_or_moderator() returns boolean
language sql stable set search_path to 'public' as $admin_fn$
 select exists(select 1 from public.admin_roles
 where user_id=(select auth.uid()) and trim(lower(role)) in ('admin','moderator'))
$admin_fn$;
create or replace function public.can_view_player_feed_post(p_author_id uuid) returns boolean
language sql stable set search_path to 'public' as $visibility_fn$
select p_author_id=(select auth.uid())
 or is_current_user_admin_or_moderator()
 or exists (
 select 1 from public.profiles viewer
 join public.subscriptions sub on sub.user_id=viewer.id
 join public.follow_relationships fr on fr.follower_id=viewer.id
  and fr.target_type='player' and fr.target_id=p_author_id
 join public.profiles author on author.id=p_author_id
 where viewer.id=(select auth.uid())
  and viewer.account_type='player' and viewer.current_country is not null
  and author.account_type='player' and author.current_country is not null
  and lower(viewer.current_country)=lower(author.current_country)
  and sub.plan in ('pro','premium')
  and sub.status in ('active','trialing')
  and coalesce(sub.access_status,'active') in ('active','trialing','pro','premium')
 )
$visibility_fn$;
grant execute on function public.is_current_user_admin_or_moderator() to authenticated;
set role authenticated;
select set_config('test.allowed_author','',false);
do $visibility_matrix$
declare visible boolean;
begin
 select public.can_view_player_feed_post('00000000-0000-0000-0000-000000000002') into visible;
 if visible is distinct from true then raise exception 'Pro same-country follower denied'; end if;
end $visibility_matrix$;
reset role;
update public.subscriptions set plan='free';
set role authenticated;
do $visibility_free$ begin
 if public.can_view_player_feed_post('00000000-0000-0000-0000-000000000002') then
 raise exception 'Free player accessed followed feed'; end if;
 if (select count(*) from public.feed_poll_votes) <> 0 then raise exception 'Free player could SELECT poll votes'; end if;
end $visibility_free$;
reset role;
update public.subscriptions set plan='premium';
update public.profiles set account_type='fan' where id='00000000-0000-0000-0000-000000000001';
set role authenticated;
do $visibility_fan$ begin
 if public.can_view_player_feed_post('00000000-0000-0000-0000-000000000002') then
 raise exception 'Premium fan accessed player-only feed'; end if;
 if (select count(*) from public.feed_poll_votes) <> 0 then raise exception 'Fan could SELECT player-only poll votes'; end if;
end $visibility_fan$;
reset role;
update public.profiles set account_type='player',current_country='Germany'
 where id='00000000-0000-0000-0000-000000000001';
set role authenticated;
do $visibility_country$ begin
 if public.can_view_player_feed_post('00000000-0000-0000-0000-000000000002') then
 raise exception 'Cross-country follower accessed feed'; end if;
 if (select count(*) from public.feed_poll_votes) <> 0 then raise exception 'Cross-country poll votes leaked'; end if;
end $visibility_country$;
reset role;
update public.profiles set current_country='Azerbaijan'
 where id='00000000-0000-0000-0000-000000000001';
delete from public.follow_relationships;
set role authenticated;
do $visibility_follow$ begin
 if public.can_view_player_feed_post('00000000-0000-0000-0000-000000000002') then
 raise exception 'Non-follower accessed feed'; end if;
 if (select count(*) from public.feed_poll_votes) <> 0 then raise exception 'Non-follower poll votes leaked'; end if;
end $visibility_follow$;
reset role;
insert into public.admin_roles values ('00000000-0000-0000-0000-000000000001','moderator');
set role authenticated;
do $visibility_moderator$ begin
 if not public.can_view_player_feed_post('00000000-0000-0000-0000-000000000002') then
 raise exception 'Moderator denied feed'; end if;
 if not public.can_view_player_feed_post('00000000-0000-0000-0000-000000000001') then
 raise exception 'Author denied own feed'; end if;
 if (select count(*) from public.feed_poll_votes) <> 2 then raise exception 'Moderator could not SELECT visible poll votes'; end if;
end $visibility_moderator$;

-- Supporting-table RLS regression: mirror the production profiles SELECT rule.
-- In particular, a private author profile is invisible to a non-admin follower.
reset role;
alter table public.profiles add column profile_visibility text not null default 'public';
alter table public.profiles enable row level security;
create policy profiles_authenticated_read on public.profiles for select to authenticated
 using (profile_visibility='public' or id=(select auth.uid())
 or public.is_current_user_admin_or_moderator());
delete from public.admin_roles;
insert into public.follow_relationships values
 ('00000000-0000-0000-0000-000000000001','player','00000000-0000-0000-0000-000000000002');
set role authenticated;
do $public_author_check$ begin
 if not public.can_view_player_feed_post('00000000-0000-0000-0000-000000000002') then
 raise exception 'Public followed author inaccessible under profile RLS'; end if;
end $public_author_check$;
reset role;
update public.profiles set profile_visibility='private'
 where id='00000000-0000-0000-0000-000000000002';
set role authenticated;
do $private_author_check$ begin
 if public.can_view_player_feed_post('00000000-0000-0000-0000-000000000002') then
 raise exception 'Private author leaked through feed visibility'; end if;
 if (select count(*) from public.feed_poll_votes) <> 0 then
 raise exception 'Private author poll votes leaked'; end if;
end $private_author_check$;
