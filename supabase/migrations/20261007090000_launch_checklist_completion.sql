-- HoopCheck launch checklist completion schema/data safeguards.
-- The live production directory was seeded separately with the verified 2026-27 team import.
alter table public.profiles add column if not exists coach_verified boolean not null default false;
alter table public.profiles add column if not exists coach_verified_at timestamptz;
alter table public.profiles add column if not exists coach_profile_id uuid references public.coaches(id) on delete set null;

create table if not exists public.directory_team_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  team_name text not null,
  country text not null,
  city text,
  league_name text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_id uuid references auth.users(id),
  reviewer_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.directory_team_requests enable row level security;
drop policy if exists directory_team_requests_select on public.directory_team_requests;
create policy directory_team_requests_select on public.directory_team_requests for select to authenticated using (requester_id=auth.uid() or public.is_current_user_admin_or_moderator());
drop policy if exists directory_team_requests_insert on public.directory_team_requests;
create policy directory_team_requests_insert on public.directory_team_requests for insert to authenticated with check (requester_id=auth.uid());

create table if not exists public.coach_team_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  requested_role text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewer_id uuid references auth.users(id),
  reviewer_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.coach_team_requests enable row level security;
drop policy if exists "coach team requests own read" on public.coach_team_requests;
create policy "coach team requests own read" on public.coach_team_requests for select to authenticated using (user_id=auth.uid() or public.is_current_user_admin_or_moderator());
drop policy if exists "coach team requests eligible insert" on public.coach_team_requests;
create policy "coach team requests eligible insert" on public.coach_team_requests for insert to authenticated with check (
  user_id=auth.uid() and exists (
    select 1 from public.profiles p join public.subscriptions s on s.user_id=p.id
    where p.id=auth.uid() and p.account_type='coach'
      and s.plan in ('pro','premium') and s.status in ('active','trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  )
);

update public.teams set active=false where lower(name)='toronto raptors';
