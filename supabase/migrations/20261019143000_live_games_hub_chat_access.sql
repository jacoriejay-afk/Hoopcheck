-- Expand the existing live chat to support the all-games hub and pre-tip/post-game chat window.
-- Membership remains restricted to active Pro/Premium Fan accounts.

drop policy if exists "pro premium fans can view live games for followed teams" on public.fan_live_games;
drop policy if exists "premium fans can view live games for followed teams" on public.fan_live_games;
create policy "active pro premium fans can view games"
on public.fan_live_games for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    where p.id = (select auth.uid()) and p.account_type = 'fan'
      and s.plan in ('pro','premium') and s.status in ('active','trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  ) or public.is_current_user_admin_or_moderator()
);

drop policy if exists "pro premium fans can read live chat" on public.fan_live_chat_messages;
drop policy if exists "premium fans can read live chat" on public.fan_live_chat_messages;
create policy "active pro premium fans can read game chat"
on public.fan_live_chat_messages for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    where p.id = (select auth.uid()) and p.account_type = 'fan'
      and s.plan in ('pro','premium') and s.status in ('active','trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  ) or public.is_current_user_admin_or_moderator()
);

drop policy if exists "pro premium fans can chat on live games" on public.fan_live_chat_messages;
drop policy if exists "premium fans can chat on live games" on public.fan_live_chat_messages;
create policy "active pro premium fans can send in open game chat"
on public.fan_live_chat_messages for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.fan_live_games g
    join public.profiles p on p.id = (select auth.uid())
    join public.subscriptions s on s.user_id = p.id
    where g.id = fan_live_chat_messages.game_id
      and p.account_type = 'fan'
      and s.plan in ('pro','premium') and s.status in ('active','trialing')
      and (s.current_period_end is null or s.current_period_end > now())
      and g.status not in ('cancelled','canceled','postponed','abandoned')
      and coalesce(g.scheduled_at, g.started_at) is not null
      and now() >= coalesce(g.scheduled_at, g.started_at) - interval '30 minutes'
      and (
        (g.ends_at is not null and now() < g.ends_at + interval '1 hour')
        or (g.ends_at is null and now() < coalesce(g.scheduled_at, g.started_at) + interval '4 hours')
      )
  )
);

-- Presence reads are limited to active Pro/Premium Fan members; users may only
-- create their own heartbeat. The UI treats heartbeats older than 90 seconds as offline.
drop policy if exists "eligible fans read game presence" on public.fan_live_chat_presence;
create policy "active pro premium fans read game presence"
on public.fan_live_chat_presence for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    where p.id = (select auth.uid()) and p.account_type = 'fan'
      and s.plan in ('pro','premium') and s.status in ('active','trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  ) or public.is_current_user_admin_or_moderator()
);
drop policy if exists "eligible fans publish own game presence" on public.fan_live_chat_presence;
create policy "active pro premium fans publish own game presence"
on public.fan_live_chat_presence for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    where p.id = (select auth.uid()) and p.account_type = 'fan'
      and s.plan in ('pro','premium') and s.status in ('active','trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  )
);
drop policy if exists "eligible fans update own game presence" on public.fan_live_chat_presence;
create policy "active pro premium fans update own game presence"
on public.fan_live_chat_presence for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    where p.id = (select auth.uid()) and p.account_type = 'fan'
      and s.plan in ('pro','premium') and s.status in ('active','trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  )
);
