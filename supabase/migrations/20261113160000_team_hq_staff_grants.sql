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
