-- Restore fan-to-fan connection requests and allow every language offered in Settings.
create table if not exists public.fan_connection_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  fan_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (requester_id, fan_id),
  check (requester_id <> fan_id),
  check (message is null or char_length(message) <= 500)
);
alter table public.fan_connection_requests enable row level security;
drop policy if exists "fan connection participants read" on public.fan_connection_requests;
create policy "fan connection participants read" on public.fan_connection_requests
  for select to authenticated using ((select auth.uid()) = requester_id or (select auth.uid()) = fan_id);
drop policy if exists "pro premium fans create requests" on public.fan_connection_requests;
create policy "pro premium fans create requests" on public.fan_connection_requests
  for insert to authenticated with check (
    (select auth.uid()) = requester_id and requester_id <> fan_id
    and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan')
    and exists (select 1 from public.profiles p where p.id=fan_id and p.account_type='fan')
    and exists (select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.plan in ('pro','premium') and s.status in ('active','trialing') and coalesce(s.access_status,'active') in ('active','trialing','pro','premium') and (s.current_period_end is null or s.current_period_end > now()))
  );
drop policy if exists "fan recipient responds" on public.fan_connection_requests;
create policy "fan recipient responds" on public.fan_connection_requests
  for update to authenticated using ((select auth.uid()) = fan_id)
  with check ((select auth.uid()) = fan_id and status in ('accepted','rejected'));
grant select, insert, update on public.fan_connection_requests to authenticated;
create index if not exists fan_connection_requests_fan_idx on public.fan_connection_requests(fan_id,status);
create index if not exists fan_connection_requests_requester_idx on public.fan_connection_requests(requester_id,status);

alter table public.profiles drop constraint if exists profiles_preferred_language_check;
alter table public.profiles add constraint profiles_preferred_language_check
  check (preferred_language = any (array['en','es','fr','de','tr','pt','it','el','ar','ru','az','pl','zh','ja','sr','fi','he','lt','uk']::text[]));
