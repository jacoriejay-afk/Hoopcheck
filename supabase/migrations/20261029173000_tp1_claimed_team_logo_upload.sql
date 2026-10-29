-- Ensure the existing claim UI has its backing queue in production.
create table if not exists public.profile_claim_requests (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('team','coach')),
  entity_id uuid not null,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  organization_email text,
  verification_method text not null check (verification_method in ('official_email','document')),
  proof_document_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profile_claim_proof_check check (
    (verification_method = 'official_email' and organization_email is not null)
    or (verification_method = 'document' and proof_document_path is not null)
  )
);
create index if not exists profile_claim_requests_status_created_idx on public.profile_claim_requests(status, created_at desc);
create index if not exists profile_claim_requests_entity_idx on public.profile_claim_requests(entity_type, entity_id, status);
create unique index if not exists profile_claim_one_pending_per_entity_idx on public.profile_claim_requests(entity_type, entity_id) where status = 'pending';
create unique index if not exists profile_claim_one_approved_per_entity_idx on public.profile_claim_requests(entity_type, entity_id) where status = 'approved';
alter table public.profile_claim_requests enable row level security;
drop policy if exists "claim request owners can read own" on public.profile_claim_requests;
create policy "claim request owners can read own" on public.profile_claim_requests for select to authenticated
  using (requester_id = (select auth.uid()) or public.is_current_user_admin_or_moderator());
drop policy if exists "users can submit profile claims" on public.profile_claim_requests;
create policy "users can submit profile claims" on public.profile_claim_requests for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');
drop policy if exists "admins manage profile claim queue" on public.profile_claim_requests;
create policy "admins manage profile claim queue" on public.profile_claim_requests for update to authenticated
  using (public.is_current_user_admin_or_moderator()) with check (public.is_current_user_admin_or_moderator());

insert into storage.buckets(id, name, public)
values ('profile-claim-proofs', 'profile-claim-proofs', false)
on conflict (id) do nothing;
drop policy if exists "claim proof owner upload" on storage.objects;
create policy "claim proof owner upload" on storage.objects for insert to authenticated
with check (bucket_id = 'profile-claim-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "claim proof owner and admin read" on storage.objects;
create policy "claim proof owner and admin read" on storage.objects for select to authenticated
using (bucket_id = 'profile-claim-proofs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_current_user_admin_or_moderator()));

create or replace function public.is_team_profile_claimed(p_team_id uuid, p_team_table text default 'teams')
returns boolean
language sql
stable
security definer
set search_path = public
as $is_team_claimed$
  select case
    when p_team_table = 'teams' then exists (
      select 1 from public.profile_claim_requests c
      where c.entity_type = 'team' and c.entity_id = p_team_id and c.status = 'approved'
    ) and exists (select 1 from public.teams t where t.id = p_team_id)
    when p_team_table = 'womens_teams' then exists (
      select 1 from public.profile_claim_requests c
      where c.entity_type = 'team' and c.entity_id = p_team_id and c.status = 'approved'
    ) and exists (select 1 from public.womens_teams t where t.id = p_team_id)
    else false
  end;
$is_team_claimed$;
revoke all on function public.is_team_profile_claimed(uuid, text) from public;
grant execute on function public.is_team_profile_claimed(uuid, text) to anon, authenticated;

-- TP-1 follow-up: allow only approved club claimants to publish a logo for their own team.
create or replace function public.set_claimed_team_logo(
  p_team_id uuid,
  p_logo_url text,
  p_logo_bg text default 'transparent',
  p_team_table text default 'teams'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_logo_bg not in ('transparent', 'light', 'dark') then
    raise exception 'Invalid logo background';
  end if;
  if p_team_table not in ('teams', 'womens_teams') then
    raise exception 'Invalid team table';
  end if;
  if p_logo_url is null or p_logo_url !~ ('^https://[^/]+/storage/v1/object/public/team-logos/' || p_team_table || '/' || p_team_id::text || '/[^?]+$') then
    raise exception 'Logo must be stored in this team''s HoopCheck Storage path';
  end if;
  if not exists (
    select 1 from public.profile_claim_requests c
    where c.entity_type = 'team'
      and c.entity_id = p_team_id
      and c.requester_id = auth.uid()
      and c.status = 'approved'
  ) then
    raise exception 'An approved claim for this team is required';
  end if;
  if p_team_table = 'teams' then
    update public.teams set logo_url = p_logo_url, logo_bg = p_logo_bg where id = p_team_id;
  else
    update public.womens_teams set logo_url = p_logo_url, logo_bg = p_logo_bg where id = p_team_id;
  end if;
  if not found then raise exception 'Team not found'; end if;
end;
$$;
revoke all on function public.set_claimed_team_logo(uuid, text, text, text) from public, anon;
grant execute on function public.set_claimed_team_logo(uuid, text, text, text) to authenticated;

drop policy if exists "Approved team claimants upload their logo" on storage.objects;
create policy "Approved team claimants upload their logo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'team-logos'
  and (storage.foldername(name))[1] in ('teams', 'womens_teams')
  and exists (
    select 1 from public.profile_claim_requests c
    where c.entity_type = 'team'
      and c.entity_id::text = (storage.foldername(name))[2]
      and c.requester_id = (select auth.uid())
      and c.status = 'approved'
  )
);
