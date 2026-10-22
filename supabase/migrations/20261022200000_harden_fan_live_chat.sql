-- Fan HQ Live Game Chat hardening: server-enforced room window, slow mode, reports, blocks, mutes.
-- The player HoopFeed tables/policies are not touched.
create table if not exists public.fan_live_chat_user_controls (
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  is_blocked boolean not null default false,
  is_muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, target_user_id),
  check (user_id <> target_user_id)
);
alter table public.fan_live_chat_user_controls enable row level security;
drop policy if exists "fans manage own live chat controls" on public.fan_live_chat_user_controls;
create policy "fans manage own live chat controls" on public.fan_live_chat_user_controls
for all to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan'
));

create table if not exists public.fan_live_chat_reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.fan_live_games(id) on delete cascade,
  message_id uuid not null references public.fan_live_chat_messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('harassment','spam','hate','threat','other')),
  details text check (char_length(coalesce(details,'')) <= 500),
  status text not null default 'open' check (status in ('open','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now(),
  unique(message_id, reporter_id)
);
alter table public.fan_live_chat_reports enable row level security;
drop policy if exists "fans report live chat messages" on public.fan_live_chat_reports;
create policy "fans report live chat messages" on public.fan_live_chat_reports
for insert to authenticated with check (
 reporter_id=(select auth.uid())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan')
 and reported_user_id <> reporter_id
 and exists(select 1 from public.fan_live_chat_messages m where m.id=message_id and m.game_id=fan_live_chat_reports.game_id and m.user_id=reported_user_id)
);
drop policy if exists "reporters view own live chat reports" on public.fan_live_chat_reports;
create policy "reporters view own live chat reports" on public.fan_live_chat_reports
for select to authenticated using (reporter_id=(select auth.uid()) or public.is_current_user_admin_or_moderator());
grant select, insert, update on public.fan_live_chat_user_controls to authenticated;
grant select, insert on public.fan_live_chat_reports to authenticated;

create or replace function public.fan_live_chat_room_open(p_game_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists (
  select 1 from public.fan_live_games g
  where g.id=p_game_id
   and g.status not in ('final','cancelled','postponed','abandoned')
   and (g.scheduled_at is not null or g.status = 'live')
   and (g.scheduled_at is null or now() >= g.scheduled_at - interval '30 minutes')
   and (g.ends_at is null or now() < g.ends_at)
 );
$$;
revoke all on function public.fan_live_chat_room_open(uuid) from public, anon;
grant execute on function public.fan_live_chat_room_open(uuid) to authenticated;

drop policy if exists "pro premium fans can chat on live games" on public.fan_live_chat_messages;
drop policy if exists "pro premium fans can read live chat" on public.fan_live_chat_messages;
drop policy if exists "pro premium fans can view live games for followed teams" on public.fan_live_games;
create policy "eligible fans view live games" on public.fan_live_games for select to authenticated
using (
 public.is_current_user_admin_or_moderator()
 or exists (
  select 1 from public.profiles p join public.subscriptions s on s.user_id=p.id
  where p.id=(select auth.uid()) and p.account_type='fan'
   and s.plan in ('pro','premium') and s.status in ('active','trialing')
   and coalesce(s.access_status,'active') in ('active','trialing','pro','premium')
   and (s.current_period_end is null or s.current_period_end>now())
 )
);
create policy "eligible fans read live chat" on public.fan_live_chat_messages for select to authenticated
using (
 public.is_current_user_admin_or_moderator()
 or (
  public.fan_live_chat_room_open(game_id)
  and exists (
   select 1 from public.profiles p join public.subscriptions s on s.user_id=p.id
   where p.id=(select auth.uid()) and p.account_type='fan'
    and s.plan in ('pro','premium') and s.status in ('active','trialing')
    and coalesce(s.access_status,'active') in ('active','trialing','pro','premium')
    and (s.current_period_end is null or s.current_period_end>now())
  )
  and not exists(select 1 from public.fan_live_chat_user_controls c where c.user_id=(select auth.uid()) and c.target_user_id=fan_live_chat_messages.user_id and c.is_blocked)
 )
);
create policy "eligible fans send live chat" on public.fan_live_chat_messages for insert to authenticated
with check (
 user_id=(select auth.uid()) and public.fan_live_chat_room_open(game_id)
 and exists (
  select 1 from public.profiles p join public.subscriptions s on s.user_id=p.id
  where p.id=(select auth.uid()) and p.account_type='fan'
   and s.plan in ('pro','premium') and s.status in ('active','trialing')
   and coalesce(s.access_status,'active') in ('active','trialing','pro','premium')
   and (s.current_period_end is null or s.current_period_end>now())
 )
 and not exists(select 1 from public.fan_live_chat_user_controls c where c.user_id=(select auth.uid()) and c.target_user_id=fan_live_chat_messages.user_id and c.is_blocked)
);

create or replace function public.enforce_fan_live_chat_slow_mode()
returns trigger language plpgsql security definer set search_path=public as $$
declare prior timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended(new.game_id::text || ':' || new.user_id::text, 0));
 if not public.fan_live_chat_room_open(new.game_id) then raise exception 'CHAT_CLOSED: Chat is closed for this game.'; end if;
 select max(created_at) into prior from public.fan_live_chat_messages where game_id=new.game_id and user_id=new.user_id;
 if prior is not null and prior > now() - interval '2 seconds' then raise exception 'SLOW_MODE: Wait two seconds between messages.'; end if;
 return new;
end; $$;
drop trigger if exists fan_live_chat_slow_mode on public.fan_live_chat_messages;
create trigger fan_live_chat_slow_mode before insert on public.fan_live_chat_messages
for each row execute function public.enforce_fan_live_chat_slow_mode();
revoke execute on function public.enforce_fan_live_chat_slow_mode() from public,anon,authenticated;

-- Presence rows are refreshed by the client heartbeat; stale rows are excluded from counts.
drop policy if exists "eligible fans publish own game presence" on public.fan_live_chat_presence;
create policy "eligible fans publish own game presence" on public.fan_live_chat_presence for insert to authenticated
with check (
 user_id=(select auth.uid()) and public.fan_live_chat_room_open(game_id)
 and exists(select 1 from public.profiles p join public.subscriptions s on s.user_id=p.id
  where p.id=(select auth.uid()) and p.account_type='fan' and s.plan in ('pro','premium')
   and s.status in ('active','trialing') and coalesce(s.access_status,'active') in ('active','trialing','pro','premium')
   and (s.current_period_end is null or s.current_period_end>now()))
);
drop policy if exists "eligible fans update own game presence" on public.fan_live_chat_presence;
create policy "eligible fans update own game presence" on public.fan_live_chat_presence for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));


-- Live-game cards need the actual room occupancy for all eligible Fan HQ members.
drop policy if exists "eligible fans read game presence" on public.fan_live_chat_presence;
create policy "eligible fans read game presence" on public.fan_live_chat_presence for select to authenticated
using (
 public.is_current_user_admin_or_moderator()
 or exists(select 1 from public.profiles p join public.subscriptions s on s.user_id=p.id
  where p.id=(select auth.uid()) and p.account_type='fan' and s.plan in ('pro','premium')
   and s.status in ('active','trialing') and coalesce(s.access_status,'active') in ('active','trialing','pro','premium')
   and (s.current_period_end is null or s.current_period_end>now()))
);

-- Realtime listeners receive join/leave heartbeats without polling the entire list.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='fan_live_chat_presence') then
  alter publication supabase_realtime add table public.fan_live_chat_presence;
 end if;
end $$;
