-- Fan-to-fan connections and expanded player-to-player contact access.
alter table public.follow_relationships drop constraint if exists follow_relationships_target_type_check;
alter table public.follow_relationships add constraint follow_relationships_target_type_check check(target_type in ('team','player','league','fan'));

create table if not exists public.fan_connection_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  fan_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique(requester_id,fan_id)
);
alter table public.fan_connection_requests enable row level security;
drop policy if exists "fan connection participants read" on public.fan_connection_requests;
drop policy if exists "pro premium fans create requests" on public.fan_connection_requests;
drop policy if exists "fan recipient responds" on public.fan_connection_requests;
create policy "fan connection participants read" on public.fan_connection_requests for select to authenticated using(auth.uid()=requester_id or auth.uid()=fan_id);
create policy "pro premium fans create requests" on public.fan_connection_requests for insert to authenticated with check(
  auth.uid()=requester_id and
  requester_id<>fan_id and
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_type='fan') and
  exists(select 1 from public.profiles p where p.id=fan_id and p.account_type='fan') and
  exists(select 1 from public.subscriptions s where s.user_id=auth.uid() and s.plan in ('pro','premium') and s.status in ('active','trialing'))
);
create policy "fan recipient responds" on public.fan_connection_requests for update to authenticated using(auth.uid()=fan_id) with check(auth.uid()=fan_id);
create index if not exists fan_connection_requests_fan_idx on public.fan_connection_requests(fan_id,status);
create index if not exists fan_connection_requests_requester_idx on public.fan_connection_requests(requester_id,status);

-- Existing player contact requests can now also be initiated by Pro/Premium players.
drop policy if exists "premium scouts agents create player contact" on public.player_contact_requests;
create policy "pro premium player scout agent create contact" on public.player_contact_requests for insert to authenticated with check(
  auth.uid()=requester_id and requester_id<>player_id and
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_type in ('player','scout','agent')) and
  exists(select 1 from public.subscriptions s where s.user_id=auth.uid() and s.plan in ('pro','premium') and s.status in ('active','trialing'))
);
