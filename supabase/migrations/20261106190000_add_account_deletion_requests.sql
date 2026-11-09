-- DEL-1 foundation: durable 30-day account deletion requests.
-- This migration only adds the request ledger. It does not change the live delete
-- endpoint, cancel subscriptions, or delete/anonymize existing user data.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'cancelled', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '30 days'),
  prior_profile_visibility text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_deletion_requests_cancelled_state_check
    check ((status = 'cancelled') = (cancelled_at is not null)),
  constraint account_deletion_requests_completed_state_check
    check ((status = 'completed') = (completed_at is not null))
);

create unique index if not exists account_deletion_requests_one_active_per_user
  on public.account_deletion_requests (user_id)
  where status in ('pending', 'processing', 'failed');

create index if not exists account_deletion_requests_due_idx
  on public.account_deletion_requests (scheduled_for)
  where status = 'pending';

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users can read their own deletion request" on public.account_deletion_requests;
create policy "Users can read their own deletion request"
  on public.account_deletion_requests
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Admins can read deletion requests" on public.account_deletion_requests;
create policy "Admins can read deletion requests"
  on public.account_deletion_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_roles ar
      where ar.user_id = (select auth.uid())
        and trim(lower(ar.role)) = 'admin'
    )
  );

revoke all on public.account_deletion_requests from anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
grant all on public.account_deletion_requests to service_role;
