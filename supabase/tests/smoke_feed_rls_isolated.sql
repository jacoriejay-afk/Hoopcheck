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
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','approved','poll','["A"]',now()-interval '1 day');
\i supabase/migrations/20261111000100_secure_feed_poll_votes.sql
\i supabase/migrations/20261111000200_secure_feed_bookmarks.sql
\i supabase/tests/verify_feed_poll_vote_policies.sql
\i supabase/tests/verify_feed_bookmark_policies.sql
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('test.allowed_author','00000000-0000-0000-0000-000000000002',false);
insert into public.feed_poll_votes(post_id,user_id,option_index) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',1);
do $$ begin
 if (select count(*) from public.feed_poll_votes) <> 1 then raise exception 'Visible vote missing'; end if;
end $$;
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
select pg_temp.expect_denied($q$insert into public.feed_post_bookmarks values ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001')$q$);
-- Positive bookmark and ownership tests under the authenticated role.
insert into public.feed_post_bookmarks(post_id,user_id) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
do $bookmark_check$ begin
 if (select count(*) from public.feed_post_bookmarks) <> 1 then raise exception 'Own bookmark missing'; end if;
end $bookmark_check$;
select pg_temp.expect_denied($q$insert into public.feed_post_bookmarks values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001')$q$);
select pg_temp.expect_denied($q$insert into public.feed_post_bookmarks values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')$q$);
select pg_temp.expect_denied($q$insert into public.feed_poll_votes values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',0)$q$);

select set_config('test.allowed_author','',false);
do $$ begin
 if (select count(*) from public.feed_poll_votes) <> 0 then raise exception 'Hidden vote leaked'; end if;
 if (select count(*) from public.feed_post_bookmarks) <> 1 then raise exception 'Own bookmark not visible'; end if;
end $$;
