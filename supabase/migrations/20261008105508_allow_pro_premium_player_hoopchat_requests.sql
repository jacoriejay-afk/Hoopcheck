-- Allow active Pro/Premium players to initiate player-to-player HoopChat requests.
drop policy if exists "pro premium players can request players" on public.player_contact_requests;
create policy "pro premium players can request players" on public.player_contact_requests for insert to authenticated with check (
  requester_id=auth.uid()
  and exists (select 1 from public.profiles p where p.id=auth.uid() and p.account_type='player')
  and exists (select 1 from public.subscriptions s where s.user_id=auth.uid() and s.plan in ('pro','premium') and s.status in ('active','trialing'))
  and exists (select 1 from public.profiles p where p.id=player_contact_requests.player_id and p.account_type='player' and p.profile_visibility='public' and p.moderation_status<>'suspended')
);