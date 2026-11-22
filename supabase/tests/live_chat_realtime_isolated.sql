-- Synthetic PostgreSQL policy smoke test, NOT a production-schema-equivalent
-- or real authenticated HTTP test. Run only against disposable postgres 16 CI.
\set ON_ERROR_STOP on

do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated;

-- Synthetic membership helpers deliberately model the existing server-side
-- entitlement gate; the real helpers require production-equivalent acceptance.
create function public.current_user_has_live_game_membership() returns boolean
language sql stable as $$
 select auth.uid() is not null and current_setting('test.live_chat_paid',true)='yes'
$$;
create function public.is_current_user_admin_or_moderator() returns boolean
language sql stable as $$
 select auth.uid() is not null and current_setting('test.live_chat_admin',true)='yes'
$$;
create table public.fan_live_games (
 id uuid primary key, status text not null, scheduled_at timestamptz,
 ends_at timestamptz
);
create table public.fan_live_chat_user_controls (
 user_id uuid not null,target_user_id uuid not null,is_blocked boolean not null default false,
 primary key(user_id,target_user_id)
);
create table public.fan_live_chat_messages (
 id uuid primary key, game_id uuid not null references public.fan_live_games(id),
 user_id uuid not null,body text not null,created_at timestamptz not null default now()
);
create table public.fan_live_chat_presence (
 game_id uuid not null,user_id uuid not null,last_seen_at timestamptz not null default now(),
 primary key(game_id,user_id)
);
alter table public.fan_live_games enable row level security;
alter table public.fan_live_chat_messages enable row level security;
alter table public.fan_live_chat_user_controls enable row level security;
alter table public.fan_live_chat_presence enable row level security;
create policy synthetic_games on public.fan_live_games for select to authenticated
using (public.current_user_has_live_game_membership());
create policy synthetic_controls on public.fan_live_chat_user_controls for select to authenticated
using (user_id=auth.uid());
-- Preserve an existing function & write policy before candidate replacement.
create function public.fan_live_chat_room_open(p_game_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.fan_live_games where id=p_game_id and status='live')
$$;
create policy "eligible members read live chat"
on public.fan_live_chat_messages for select to authenticated
using (
 public.current_user_has_live_game_membership()
 and public.fan_live_chat_room_open(game_id)
);
create policy "eligible members send live chat"
on public.fan_live_chat_messages for insert to authenticated
with check (
 user_id=auth.uid() and public.current_user_has_live_game_membership()
 and public.fan_live_chat_room_open(game_id)
);
grant select on public.fan_live_games,public.fan_live_chat_user_controls to authenticated;
grant select,insert on public.fan_live_chat_messages to authenticated;
grant execute on function public.current_user_has_live_game_membership(),
 public.is_current_user_admin_or_moderator(),
 public.fan_live_chat_room_open(uuid) to authenticated;
create publication supabase_realtime for table public.fan_live_games;

insert into public.fan_live_games values
 ('10000000-0000-4000-8000-000000000001','scheduled',now()+interval '30 minutes',null),
 ('10000000-0000-4000-8000-000000000002','scheduled',now()+interval '2 hours',null),
 ('10000000-0000-4000-8000-000000000003','live',now()-interval '1 hour',null),
 ('10000000-0000-4000-8000-000000000004','final',now()-interval '4 hours',now()-interval '119 minutes'),
 ('10000000-0000-4000-8000-000000000005','final',now()-interval '4 hours',now()-interval '121 minutes'),
 ('10000000-0000-4000-8000-000000000006','final',now()-interval '4 hours',null),
 ('10000000-0000-4000-8000-000000000007','cancelled',now()+interval '30 minutes',null),
 ('10000000-0000-4000-8000-000000000008','live',now()-interval '5 hours',null);
insert into public.fan_live_chat_messages(id,game_id,user_id,body) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','22222222-2222-4222-8222-222222222222','saved final'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','33333333-3333-4333-8333-333333333333','blocked final');
insert into public.fan_live_chat_user_controls values
 ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',true);

-- Apply the exact review-only candidate in disposable CI.
\i supabase/candidates/live_game_chat_realtime_directory_review_only.sql

-- The function and two associated realtime tables must be registered.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='fan_live_chat_messages') then
  raise exception 'Realtime messages table not registered';
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='fan_live_chat_presence') then
  raise exception 'Realtime presence table not registered';
 end if;
 if has_function_privilege('anon','public.fan_live_chat_room_open(uuid)','EXECUTE') then
  raise exception 'Anonymous caller may invoke protected game-room RPC';
 end if;
 if has_table_privilege('anon','public.fan_live_chat_messages','INSERT') then
  raise exception 'Anonymous caller can insert chat messages';
 end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('test.live_chat_paid','yes',false);
select set_config('test.live_chat_admin','no',false);
do $check$
declare statuses boolean[];
begin
 select array_agg(public.fan_live_chat_room_open(id) order by id) into statuses from (
   values
   ('10000000-0000-4000-8000-000000000001'::uuid),
   ('10000000-0000-4000-8000-000000000002'::uuid),
   ('10000000-0000-4000-8000-000000000003'::uuid),
   ('10000000-0000-4000-8000-000000000004'::uuid),
   ('10000000-0000-4000-8000-000000000005'::uuid),
   ('10000000-0000-4000-8000-000000000006'::uuid),
   ('10000000-0000-4000-8000-000000000007'::uuid),
   ('10000000-0000-4000-8000-000000000008'::uuid)
 ) ids(id);
 if statuses is distinct from array[true,false,true,true,false,false,false,false]::boolean[] then
  raise exception 'Room window mismatch: %',statuses;
 end if;
 if (select count(*) from public.fan_live_chat_messages)!=1 then
  raise exception 'Paid member must read one unblocked saved final message';
 end if;
 insert into public.fan_live_chat_messages values(
  '20000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '11111111-1111-4111-8111-111111111111','new post-game message',now());
 if (select count(*) from public.fan_live_chat_messages)!=2 then
  raise exception 'Paid member cannot insert inside verified post-game window';
 end if;
 -- An expired room must reject inserts, even though saved history can be read.
 begin
  insert into public.fan_live_chat_messages values(
   '20000000-0000-4000-8000-000000000004',
   '10000000-0000-4000-8000-000000000005',
   '11111111-1111-4111-8111-111111111111','too late',now());
  raise exception 'Closed-room insert incorrectly accepted';
 exception when insufficient_privilege then null;
 end;
end $check$;
select set_config('test.live_chat_paid','no',false);
do $$ begin
 if exists(select 1 from public.fan_live_chat_messages) then
  raise exception 'Free/unentitled caller read saved messages';
 end if;
 begin
  insert into public.fan_live_chat_messages values(
   '20000000-0000-4000-8000-000000000005',
   '10000000-0000-4000-8000-000000000003',
   '11111111-1111-4111-8111-111111111111','no membership',now());
  raise exception 'Unentitled insert incorrectly accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select 'PASS: synthetic RLS chat windows, membership, blocked users, realtime, closed inserts' as verdict;
