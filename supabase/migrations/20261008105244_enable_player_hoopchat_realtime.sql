-- Production HoopChat schema + Realtime publication.
create table if not exists public.player_contact_requests (
  id uuid primary key default gen_random_uuid(), requester_id uuid not null references public.profiles(id) on delete cascade, player_id uuid not null references public.profiles(id) on delete cascade,
  message text, status text not null default 'pending' check (status in ('pending','accepted','rejected')), created_at timestamptz not null default now(), responded_at timestamptz,
  unique(requester_id, player_id)
);
create index if not exists idx_player_contact_requests_player on public.player_contact_requests(player_id,status,created_at desc);
create index if not exists idx_player_contact_requests_requester on public.player_contact_requests(requester_id,status,created_at desc);
create table if not exists public.player_contact_messages (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.player_contact_requests(id) on delete cascade, sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000), created_at timestamptz not null default now()
);
create index if not exists idx_player_contact_messages_request on public.player_contact_messages(request_id,created_at);
alter table public.player_contact_requests enable row level security;
alter table public.player_contact_messages enable row level security;
drop policy if exists "contact participants can view requests" on public.player_contact_requests;
create policy "contact participants can view requests" on public.player_contact_requests for select to authenticated using (requester_id=auth.uid() or player_id=auth.uid());
drop policy if exists "premium scouts agents can request players" on public.player_contact_requests;
create policy "premium scouts agents can request players" on public.player_contact_requests for insert to authenticated with check (requester_id=auth.uid() and exists (select 1 from public.profiles p where p.id=auth.uid() and p.account_type in ('scout','agent')) and exists (select 1 from public.subscriptions s where s.user_id=auth.uid() and s.plan='premium' and s.status in ('active','trialing')) and exists (select 1 from public.profiles p where p.id=player_contact_requests.player_id and p.account_type='player' and p.profile_visibility='public' and p.moderation_status<>'suspended'));
drop policy if exists "players can respond to requests" on public.player_contact_requests;
create policy "players can respond to requests" on public.player_contact_requests for update to authenticated using (player_id=auth.uid()) with check (player_id=auth.uid() and status in ('accepted','rejected'));
drop policy if exists "accepted participants can view messages" on public.player_contact_messages;
create policy "accepted participants can view messages" on public.player_contact_messages for select to authenticated using (exists (select 1 from public.player_contact_requests r where r.id=player_contact_messages.request_id and r.status='accepted' and (r.requester_id=auth.uid() or r.player_id=auth.uid())));
drop policy if exists "accepted participants can send messages" on public.player_contact_messages;
create policy "accepted participants can send messages" on public.player_contact_messages for insert to authenticated with check (sender_id=auth.uid() and exists (select 1 from public.player_contact_requests r where r.id=player_contact_messages.request_id and r.status='accepted' and (r.requester_id=auth.uid() or r.player_id=auth.uid())));
alter table public.player_contact_messages replica identity full;
do $$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='player_contact_messages') then alter publication supabase_realtime add table public.player_contact_messages; end if; end $$;