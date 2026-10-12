-- Extend live game chat to active Pro and Premium Fans and stream live score/status changes.
-- This migration is committed for review; it is not applied to the production database here.

drop policy if exists "premium fans can view live games for followed teams" on public.fan_live_games;
create policy "pro premium fans can view live games for followed teams"
on public.fan_live_games
for select to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    join public.follow_relationships f on f.follower_id = p.id
      and f.target_type = 'team'::text
      and f.target_id = fan_live_games.team_id
    where p.id = (select auth.uid())
      and p.account_type = 'fan'::text
      and s.plan in ('pro'::text, 'premium'::text)
      and s.status in ('active'::text, 'trialing'::text)
      and (s.current_period_end is null or s.current_period_end > now())
  )
  or public.is_current_user_admin_or_moderator()
);

drop policy if exists "premium fans can read live chat" on public.fan_live_chat_messages;
create policy "pro premium fans can read live chat"
on public.fan_live_chat_messages
for select to authenticated
using (
  exists (
    select 1
    from public.fan_live_games g
    join public.follow_relationships f on f.target_type = 'team'::text
      and f.target_id = g.team_id and f.follower_id = (select auth.uid())
    join public.subscriptions s on s.user_id = (select auth.uid())
    join public.profiles p on p.id = (select auth.uid())
    where g.id = fan_live_chat_messages.game_id
      and p.account_type = 'fan'::text
      and s.plan in ('pro'::text, 'premium'::text)
      and s.status in ('active'::text, 'trialing'::text)
      and (s.current_period_end is null or s.current_period_end > now())
  )
  or public.is_current_user_admin_or_moderator()
);

drop policy if exists "premium fans can chat on live games" on public.fan_live_chat_messages;
create policy "pro premium fans can chat on live games"
on public.fan_live_chat_messages
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.fan_live_games g
    join public.follow_relationships f on f.target_type = 'team'::text
      and f.target_id = g.team_id and f.follower_id = (select auth.uid())
    join public.subscriptions s on s.user_id = (select auth.uid())
    join public.profiles p on p.id = (select auth.uid())
    where g.id = fan_live_chat_messages.game_id
      and g.status = 'live'::text
      and p.account_type = 'fan'::text
      and s.plan in ('pro'::text, 'premium'::text)
      and s.status in ('active'::text, 'trialing'::text)
      and (s.current_period_end is null or s.current_period_end > now())
  )
);

alter table public.fan_live_games replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fan_live_games'
  ) then
    alter publication supabase_realtime add table public.fan_live_games;
  end if;
end
$$;
