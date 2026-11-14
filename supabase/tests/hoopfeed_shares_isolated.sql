-- Isolated SHARE-1 policy regression using the actual versioned inbox migration.
-- Synthetic users only. Does not touch Supabase production data.
\set ON_ERROR_STOP on
do $ begin
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $;
create schema auth;
create schema private;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.profiles(id uuid primary key);
create table public.feed_posts(
 id uuid primary key, author_id uuid not null references public.profiles(id),
 status text not null, expires_at timestamptz
);
create table public.user_blocks(blocker_id uuid not null,blocked_id uuid not null);
alter table public.feed_posts enable row level security;
create policy "test recipient post access" on public.feed_posts for select to authenticated
 using (author_id=auth.uid() or author_id=nullif(current_setting('test.allowed_author',true),'')::uuid);
grant usage on schema public,auth,private to authenticated;
grant usage on schema public,auth to anon;
grant execute on function auth.uid() to authenticated;
grant select on public.feed_posts to authenticated;
insert into public.profiles values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003');
insert into public.feed_posts values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','approved',null),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','pending',null),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','approved',now()-interval '1 day');
\i supabase/migrations/20261114003000_hoopfeed_post_shares_private_inbox.sql
insert into public.hoopfeed_post_shares(post_id,sender_id,recipient_id) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('test.allowed_author','00000000-0000-0000-0000-000000000002',false);
do $$ begin
 if (select count(*) from public.hoopfeed_post_shares) <> 1 then
  raise exception 'Recipient should see only approved, unexpired, authorized shares'; end if;
end $$;
select set_config('test.allowed_author','',false);
do $$ begin
 if exists(select 1 from public.hoopfeed_post_shares) then raise exception 'Revoked post access leaked share'; end if;
end $$;
reset role;
insert into public.user_blocks values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
set role authenticated;
select set_config('test.allowed_author','00000000-0000-0000-0000-000000000002',false);
do $$ begin
 if exists(select 1 from public.hoopfeed_post_shares) then raise exception 'Blocked sender leaked share'; end if;
end $$;
reset role;
delete from public.user_blocks;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
 if exists(select 1 from public.hoopfeed_post_shares) then raise exception 'Unrelated user accessed inbox'; end if;
end $$;
reset role;
set role anon;
do $$ begin
 begin
  perform 1 from public.hoopfeed_post_shares;
  raise exception 'Anonymous inbox SELECT unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
