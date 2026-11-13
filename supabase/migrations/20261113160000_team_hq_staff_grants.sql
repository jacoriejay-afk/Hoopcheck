-- TEAMHQ-1 Part A: private, club-scoped manager grants and immutable audit events.
-- Migration is staged only; do not apply to production without review.
create table if not exists public.team_hq_staff (
  club_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (club_id, user_id)
);
create table if not exists public.team_hq_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.teams(id) on delete cascade,
  invitee_email text not null,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint team_hq_invite_seven_days check (expires_at <= created_at + interval '7 days'),
  constraint team_hq_invite_email_valid check (length(trim(invitee_email)) between 3 and 254)
);
create table if not exists public.team_hq_audit (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.teams(id),
  actor_id uuid not null references auth.users(id),
  target_user_id uuid references auth.users(id),
  action text not null check (action in ('invite','accept','revoke','transfer','profile_edit','roster_change','verify_stint','review_reply','fan_pin','fan_remove','fan_mute')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists team_hq_invitations_club_expiry_idx on public.team_hq_invitations(club_id,expires_at);
create index if not exists team_hq_audit_club_created_idx on public.team_hq_audit(club_id,created_at desc);
alter table public.team_hq_staff enable row level security;
alter table public.team_hq_invitations enable row level security;
alter table public.team_hq_audit enable row level security;
revoke all on public.team_hq_staff from anon,authenticated;
revoke all on public.team_hq_invitations from anon,authenticated;
revoke all on public.team_hq_audit from anon,authenticated;
-- No client-side policies or direct mutation privileges. A future authenticated,
-- atomic server/RPC flow must validate approved owner claim, verified invitee
-- identity and invitation expiry, then write staff + audit in one transaction.

-- Atomic invitation creation: the caller identity must come from a verified
-- server session. Never expose this function to browser roles.
create or replace function public.team_hq_create_invitation(
  p_actor uuid, p_club uuid, p_email text
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid; v_email text := lower(trim(p_email));
begin
  if p_actor is null or p_club is null or v_email is null or
     length(v_email) not between 3 and 254 or position('@' in v_email) < 2 then
    raise exception 'Invalid invitation request';
  end if;
  if not exists (
    select 1 from public.profile_claim_requests
    where requester_id = p_actor and entity_type = 'team'
      and entity_id = p_club and status = 'approved'
  ) then
    raise exception 'Approved club owner required';
  end if;
  insert into public.team_hq_invitations (club_id,invitee_email,invited_by)
    values (p_club,v_email,p_actor) returning id into v_id;
  insert into public.team_hq_audit (club_id,actor_id,action,detail)
    values (p_club,p_actor,'invite',jsonb_build_object('invitation_id',v_id));
  return v_id;
end;
$$;
revoke all on function public.team_hq_create_invitation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.team_hq_create_invitation(uuid,uuid,text) to service_role;

-- Accept an invitation and create staff access + audit atomically.
-- Only the service role may call this function; the API must authenticate the
-- bearer token and pass the verified auth user ID, never a client-supplied ID.
create or replace function public.team_hq_accept_invitation(
  p_actor uuid, p_invitation uuid
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_inv public.team_hq_invitations%rowtype;
  v_email text;
begin
  if p_actor is null or p_invitation is null then
    raise exception 'Invalid invitation request';
  end if;
  select * into v_inv from public.team_hq_invitations
    where id = p_invitation for update;
  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null
     or now() >= v_inv.expires_at then
    raise exception 'Invitation is unavailable';
  end if;
  select lower(trim(email)) into v_email from auth.users
    where id = p_actor and email_confirmed_at is not null;
  if v_email is null or v_email <> lower(trim(v_inv.invitee_email)) then
    raise exception 'Verified invitee email does not match';
  end if;
  if p_actor = v_inv.invited_by or not exists (
    select 1 from public.profile_claim_requests
    where requester_id = v_inv.invited_by and entity_type = 'team'
      and entity_id = v_inv.club_id and status = 'approved'
  ) then
    raise exception 'Inviting club owner is no longer eligible';
  end if;
  insert into public.team_hq_staff (club_id,user_id,invited_by,accepted_at,revoked_at)
    values (v_inv.club_id,p_actor,v_inv.invited_by,now(),null)
    on conflict (club_id,user_id) do update
      set invited_by = excluded.invited_by, accepted_at = excluded.accepted_at, revoked_at = null;
  update public.team_hq_invitations
    set accepted_by = p_actor, accepted_at = now()
    where id = p_invitation;
  insert into public.team_hq_audit (club_id,actor_id,target_user_id,action,detail)
    values (v_inv.club_id,p_actor,p_actor,'accept',jsonb_build_object('invitation_id',p_invitation));
  return v_inv.club_id;
end;
$$;
revoke all on function public.team_hq_accept_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.team_hq_accept_invitation(uuid,uuid) to service_role;
