-- Optimize repeated auth.uid() calls in messaging, live-game, and women's review policies.
-- Existing role, ownership, subscription, status, and moderator checks are preserved.

drop policy if exists "womens reviews approved read" on public.womens_team_reviews;
create policy "womens reviews approved read"
on public.womens_team_reviews
for select to anon, authenticated
using ((status = 'approved'::text) or (author_id = (select auth.uid())) or public.is_current_user_admin_or_moderator());

drop policy if exists "contact participants can view requests" on public.player_contact_requests;
create policy "contact participants can view requests"
on public.player_contact_requests
for select to authenticated
using ((requester_id = (select auth.uid())) or (player_id = (select auth.uid())));

drop policy if exists "players can respond to requests" on public.player_contact_requests;
create policy "players can respond to requests"
on public.player_contact_requests
for update to authenticated
using (player_id = (select auth.uid()))
with check ((player_id = (select auth.uid())) and (status = any (array['accepted'::text, 'rejected'::text])));

drop policy if exists "premium scouts agents can request players" on public.player_contact_requests;
create policy "premium scouts agents can request players"
on public.player_contact_requests
for insert to authenticated
with check (
  (requester_id = (select auth.uid()))
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = any (array['scout'::text, 'agent'::text]))
  and exists (select 1 from public.subscriptions s where s.user_id = (select auth.uid()) and s.plan = 'premium'::text and s.status = any (array['active'::text, 'trialing'::text]))
  and exists (select 1 from public.profiles p where p.id = player_contact_requests.player_id and p.account_type = 'player'::text and p.profile_visibility = 'public'::text and p.moderation_status <> 'suspended'::text)
);

drop policy if exists "pro premium players can request players" on public.player_contact_requests;
create policy "pro premium players can request players"
on public.player_contact_requests
for insert to authenticated
with check (
  (requester_id = (select auth.uid()))
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'player'::text)
  and exists (select 1 from public.subscriptions s where s.user_id = (select auth.uid()) and s.plan = any (array['pro'::text, 'premium'::text]) and s.status = any (array['active'::text, 'trialing'::text]))
  and exists (select 1 from public.profiles p where p.id = player_contact_requests.player_id and p.account_type = 'player'::text and p.profile_visibility = 'public'::text and p.moderation_status <> 'suspended'::text)
);

drop policy if exists "accepted participants can view messages" on public.player_contact_messages;
create policy "accepted participants can view messages"
on public.player_contact_messages
for select to authenticated
using (
  exists (
    select 1 from public.player_contact_requests r
    where r.id = player_contact_messages.request_id
      and r.status = 'accepted'::text
      and ((r.requester_id = (select auth.uid())) or (r.player_id = (select auth.uid())))
  )
);

drop policy if exists "accepted participants can send messages" on public.player_contact_messages;
create policy "accepted participants can send messages"
on public.player_contact_messages
for insert to authenticated
with check (
  (sender_id = (select auth.uid()))
  and exists (
    select 1 from public.player_contact_requests r
    where r.id = player_contact_messages.request_id
      and r.status = 'accepted'::text
      and ((r.requester_id = (select auth.uid())) or (r.player_id = (select auth.uid())))
  )
);

drop policy if exists "premium fans can view live games for followed teams" on public.fan_live_games;
create policy "premium fans can view live games for followed teams"
on public.fan_live_games
for select to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.subscriptions s on s.user_id = p.id
    join public.follow_relationships f on f.follower_id = p.id and f.target_type = 'team'::text and f.target_id = fan_live_games.team_id
    where p.id = (select auth.uid())
      and p.account_type = 'fan'::text
      and s.plan = 'premium'::text
      and s.status = any (array['active'::text, 'trialing'::text])
      and (s.current_period_end is null or s.current_period_end > now())
  )
  or public.is_current_user_admin_or_moderator()
);

drop policy if exists "premium fans can read live chat" on public.fan_live_chat_messages;
create policy "premium fans can read live chat"
on public.fan_live_chat_messages
for select to authenticated
using (
  exists (
    select 1
    from public.fan_live_games g
    join public.follow_relationships f on f.target_type = 'team'::text and f.target_id = g.team_id and f.follower_id = (select auth.uid())
    join public.subscriptions s on s.user_id = (select auth.uid())
    join public.profiles p on p.id = (select auth.uid())
    where g.id = fan_live_chat_messages.game_id
      and p.account_type = 'fan'::text
      and s.plan = 'premium'::text
      and s.status = any (array['active'::text, 'trialing'::text])
      and (s.current_period_end is null or s.current_period_end > now())
  )
  or public.is_current_user_admin_or_moderator()
);

drop policy if exists "premium fans can chat on live games" on public.fan_live_chat_messages;
create policy "premium fans can chat on live games"
on public.fan_live_chat_messages
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.fan_live_games g
    join public.follow_relationships f on f.target_type = 'team'::text and f.target_id = g.team_id and f.follower_id = (select auth.uid())
    join public.subscriptions s on s.user_id = (select auth.uid())
    join public.profiles p on p.id = (select auth.uid())
    where g.id = fan_live_chat_messages.game_id
      and g.status = 'live'::text
      and p.account_type = 'fan'::text
      and s.plan = 'premium'::text
      and s.status = any (array['active'::text, 'trialing'::text])
      and (s.current_period_end is null or s.current_period_end > now())
  )
);
