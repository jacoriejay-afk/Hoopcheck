\set ON_ERROR_STOP on
begin;
create schema auth;
create schema private;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
revoke all on schema private from public,anon,authenticated;
grant usage on schema auth, private to authenticated;
create function auth.uid() returns uuid language sql stable as
$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $;
create function public.is_current_user_admin_or_moderator() returns boolean language sql stable as
$ select auth.uid() is not null and coalesce(current_setting('test.staff',true),'no')='yes' $;
create table public.user_blocks(blocker_id uuid not null,blocked_id uuid not null,primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id));
create table public.player_contact_requests(id uuid primary key,requester_id uuid not null,player_id uuid not null,status text not null);
create table public.player_contact_messages(id uuid primary key,request_id uuid references public.player_contact_requests(id),sender_id uuid not null);
create table public.feed_post_comments(id uuid primary key,author_id uuid not null);
create table public.hoop_group_posts(id uuid primary key,author_id uuid not null);
create table public.fan_live_chat_messages(id uuid primary key,user_id uuid not null);
alter table public.user_blocks enable row level security;
alter table public.player_contact_requests enable row level security;
alter table public.player_contact_messages enable row level security;
alter table public.feed_post_comments enable row level security;
alter table public.hoop_group_posts enable row level security;
alter table public.fan_live_chat_messages enable row level security;
grant select,insert,delete on public.user_blocks to authenticated;
create policy own_block_read on public.user_blocks for select to authenticated using(blocker_id=auth.uid());
create policy own_block_insert on public.user_blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy own_block_delete on public.user_blocks for delete to authenticated using(blocker_id=auth.uid());
grant select,insert on public.player_contact_requests,public.player_contact_messages to authenticated;
grant update(status) on public.player_contact_requests to authenticated;
grant select on public.feed_post_comments,public.hoop_group_posts,public.fan_live_chat_messages to authenticated;
create policy contact_read on public.player_contact_requests for select to authenticated using(auth.uid() in (requester_id,player_id));
create policy contact_insert on public.player_contact_requests for insert to authenticated with check(requester_id=auth.uid() and current_setting('test.member',true)='yes');
create policy contact_update on public.player_contact_requests for update to authenticated using(player_id=auth.uid()) with check(player_id=auth.uid() and status in ('accepted','rejected'));
create policy messages_read on public.player_contact_messages for select to authenticated using(exists(select 1 from public.player_contact_requests r where r.id=request_id and r.status='accepted'));
create policy messages_insert on public.player_contact_messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.player_contact_requests r where r.id=request_id and r.status='accepted'));
create policy comments_member on public.feed_post_comments for select to authenticated using(current_setting('test.member',true)='yes');
create policy groups_member on public.hoop_group_posts for select to authenticated using(current_setting('test.member',true)='yes');
create policy live_member on public.fan_live_chat_messages for select to authenticated using(public.is_current_user_admin_or_moderator() or current_setting('test.member',true)='yes');

insert into public.player_contact_requests values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','accepted');
insert into public.player_contact_messages values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
insert into public.feed_post_comments values
('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
insert into public.hoop_group_posts select * from public.feed_post_comments;
insert into public.fan_live_chat_messages select * from public.feed_post_comments;

\i supabase/candidates/post16_global_block_boundary_review_only.sql
do $$ begin
  if has_function_privilege('anon','private.post16_account_interaction_allowed(uuid)','EXECUTE') then raise exception 'anon can call helper'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select set_config('test.member','yes',true);
select set_config('test.staff','no',true);
do $ begin
  if (select count(*) from public.player_contact_requests)<>1 or (select count(*) from public.player_contact_messages)<>1 or (select count(*) from public.feed_post_comments)<>1 or (select count(*) from public.hoop_group_posts)<>1 or (select count(*) from public.fan_live_chat_messages)<>1 then raise exception 'unblocked baseline not preserved'; end if;
end $$;
select set_config('test.member','no',true);
do $$ begin
  if exists(select 1 from public.feed_post_comments) or exists(select 1 from public.hoop_group_posts) or exists(select 1 from public.fan_live_chat_messages) then raise exception 'existing membership gate bypassed'; end if;
end $$;
select set_config('test.member','yes',true);
insert into public.user_blocks values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
do $$ begin
  if exists(select 1 from public.player_contact_requests) or exists(select 1 from public.player_contact_messages) or exists(select 1 from public.feed_post_comments) or exists(select 1 from public.hoop_group_posts) or exists(select 1 from public.fan_live_chat_messages) then raise exception 'outgoing block did not hide content'; end if;
  begin
    insert into public.player_contact_messages values('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
    raise exception 'blocked message insert succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.player_contact_requests values('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','pending');
    raise exception 'blocked contact insert succeeded';
  exception when insufficient_privilege then null; end;
end $$;
-- Staff safety review must preserve existing live-room access only.
select set_config('test.staff','yes',true);
select set_config('test.member','no',true);
do $ begin
  if (select count(*) from public.fan_live_chat_messages)<>1 then raise exception 'Existing live moderation visibility lost'; end if;
  if exists(select 1 from public.player_contact_requests) or exists(select 1 from public.player_contact_messages) or exists(select 1 from public.feed_post_comments) or exists(select 1 from public.hoop_group_posts) then raise exception 'Staff bypass escaped existing live moderation scope'; end if;
end $;
select set_config('test.staff','no',true);
select set_config('test.member','yes',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.user_blocks) then raise exception 'reverse block list leaked'; end if;
  if exists(select 1 from public.player_contact_requests) or exists(select 1 from public.player_contact_messages) then raise exception 'reverse block failed'; end if;
  begin
    insert into public.player_contact_messages values('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
    raise exception 'reverse-block message insert succeeded';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.feed_post_comments)<>1 then raise exception 'self content lost'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$ begin
  if exists(select 1 from public.player_contact_requests) or exists(select 1 from public.player_contact_messages) then raise exception 'nonparticipant saw private conversation'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
delete from public.user_blocks where blocker_id=auth.uid() and blocked_id='00000000-0000-4000-8000-000000000002';
do $$ begin
  if (select count(*) from public.player_contact_requests)<>1 or (select count(*) from public.player_contact_messages)<>1 or (select count(*) from public.feed_post_comments)<>1 then raise exception 'unblock did not restore eligible content'; end if;
end $$;
reset role;
rollback;
