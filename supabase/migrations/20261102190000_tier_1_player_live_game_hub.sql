-- TIER-1: extend the existing Live Game Hub from paid fans to paid players.
-- Free players retain prediction-only access. Fan HQ membership rules are unchanged.

create or replace function public.current_user_has_live_game_membership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    where p.id = (select auth.uid())
      and p.account_type in ('fan', 'player')
      and case s.plan
        when 'premium' then 2
        when 'pro' then 1
        else 0
      end >= 1
      and s.status in ('active', 'trialing')
      and coalesce(s.access_status, 'active') in ('active', 'trialing', 'pro', 'premium')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

revoke all on function public.current_user_has_live_game_membership() from public, anon;
grant execute on function public.current_user_has_live_game_membership() to authenticated;

drop policy if exists "eligible fans view live games" on public.fan_live_games;
drop policy if exists "active pro premium fans can view games" on public.fan_live_games;
create policy "eligible members view live games"
on public.fan_live_games for select to authenticated
using (
  public.is_current_user_admin_or_moderator()
  or public.current_user_has_live_game_membership()
);

drop policy if exists "eligible fans read live chat" on public.fan_live_chat_messages;
drop policy if exists "active pro premium fans can read game chat" on public.fan_live_chat_messages;
create policy "eligible members read live chat"
on public.fan_live_chat_messages for select to authenticated
using (
  public.is_current_user_admin_or_moderator()
  or (
    public.current_user_has_live_game_membership()
    and public.fan_live_chat_room_open(game_id)
    and not exists (
      select 1 from public.fan_live_chat_user_controls c
      where c.user_id = (select auth.uid())
        and c.target_user_id = fan_live_chat_messages.user_id
        and c.is_blocked
    )
  )
);

drop policy if exists "eligible fans send live chat" on public.fan_live_chat_messages;
drop policy if exists "active pro premium fans can send in open game chat" on public.fan_live_chat_messages;
create policy "eligible members send live chat"
on public.fan_live_chat_messages for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.current_user_has_live_game_membership()
  and public.fan_live_chat_room_open(game_id)
  and not exists (
    select 1 from public.fan_live_chat_user_controls c
    where c.user_id = (select auth.uid())
      and c.target_user_id = fan_live_chat_messages.user_id
      and c.is_blocked
  )
);

-- Keep existing Fan HQ moderation tools and extend the same tools to paid players
-- who are now permitted to participate in the same rooms.
drop policy if exists "fans manage own live chat controls" on public.fan_live_chat_user_controls;
create policy "eligible members manage own live chat controls"
on public.fan_live_chat_user_controls for all to authenticated
using (
  user_id = (select auth.uid())
  and public.current_user_has_live_game_membership()
)
with check (
  user_id = (select auth.uid())
  and public.current_user_has_live_game_membership()
  and target_user_id <> (select auth.uid())
);

drop policy if exists "fans report live chat messages" on public.fan_live_chat_reports;
create policy "eligible members report live chat messages"
on public.fan_live_chat_reports for insert to authenticated
with check (
  reporter_id = (select auth.uid())
  and public.current_user_has_live_game_membership()
  and reported_user_id <> reporter_id
  and exists (
    select 1 from public.fan_live_chat_messages m
    where m.id = message_id
      and m.game_id = fan_live_chat_reports.game_id
      and m.user_id = reported_user_id
  )
);

drop policy if exists "eligible fans publish own game presence" on public.fan_live_chat_presence;
drop policy if exists "active pro premium fans publish own game presence" on public.fan_live_chat_presence;
create policy "eligible members publish own game presence"
on public.fan_live_chat_presence for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.current_user_has_live_game_membership()
  and public.fan_live_chat_room_open(game_id)
);

drop policy if exists "eligible fans update own game presence" on public.fan_live_chat_presence;
drop policy if exists "active pro premium fans update own game presence" on public.fan_live_chat_presence;
create policy "eligible members update own game presence"
on public.fan_live_chat_presence for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and public.current_user_has_live_game_membership()
  and public.fan_live_chat_room_open(game_id)
);

drop policy if exists "eligible fans read game presence" on public.fan_live_chat_presence;
drop policy if exists "active pro premium fans read game presence" on public.fan_live_chat_presence;
create policy "eligible members read game presence"
on public.fan_live_chat_presence for select to authenticated
using (
  public.is_current_user_admin_or_moderator()
  or public.current_user_has_live_game_membership()
);
