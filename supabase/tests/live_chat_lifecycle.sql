-- Isolated PostgreSQL fixture: never run against a production database.
create schema if not exists auth;
create role authenticated;
create role anon;
create table public.fan_live_games (
  id uuid primary key, status text, scheduled_at timestamptz,
  started_at timestamptz, ends_at timestamptz
);
create table public.fan_live_chat_presence (
  game_id uuid, user_id uuid
);
create function public.is_current_user_admin_or_moderator()
returns boolean language sql stable as $$select false$$;
create function public.current_user_has_live_game_membership()
returns boolean language sql stable as $$select true$$;
alter table public.fan_live_chat_presence enable row level security;
\ir ../migrations/20261111200000_live_chat_room_lifecycle.sql
insert into public.fan_live_games(id,status,scheduled_at,ends_at) values
('00000000-0000-0000-0000-000000000001','scheduled',now()+interval '61 minutes',null),
('00000000-0000-0000-0000-000000000002','scheduled',now()+interval '59 minutes',null),
('00000000-0000-0000-0000-000000000003','final',now()-interval '4 hours',now()-interval '119 minutes'),
('00000000-0000-0000-0000-000000000004','final',now()-interval '4 hours',now()-interval '121 minutes'),
('00000000-0000-0000-0000-000000000005','cancelled',now(),null),
('00000000-0000-0000-0000-000000000006','live',null,now()-interval '121 minutes'),
('00000000-0000-0000-0000-000000000007','live',null,null),
('00000000-0000-0000-0000-000000000008','final',null,null);
do $$
declare i integer; expected boolean; actual boolean;
begin
  for i in 1..8 loop
    expected := i in (2,3,7);
    actual := public.fan_live_chat_room_open(('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid);
    if actual is distinct from expected then
      raise exception 'Lifecycle case %: expected %, got %',i,expected,actual;
    end if;
  end loop;
end $$;
-- Verify RLS behavior with authenticated role, not the table owner.
grant usage on schema public to authenticated;
grant select on public.fan_live_chat_presence to authenticated;
grant execute on function public.is_current_user_admin_or_moderator() to authenticated;
grant execute on function public.current_user_has_live_game_membership() to authenticated;
insert into public.fan_live_chat_presence(game_id,user_id) values
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101'),
('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000102');
set role authenticated;
do $$
declare count_visible integer;
begin
  select count(*) into count_visible from public.fan_live_chat_presence;
  if count_visible <> 1 then
    raise exception 'Presence RLS expected one open-room row, got %',count_visible;
  end if;
end $$;
reset role;
select 'Isolated lifecycle and RLS tests passed' as result;
