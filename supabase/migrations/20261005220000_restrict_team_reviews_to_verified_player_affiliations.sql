-- Restrict team reviews to verified players with verified current/former team affiliations.
create table if not exists public.player_team_affiliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  relationship text not null check (relationship in ('current','former')),
  start_date date,
  end_date date,
  verified boolean not null default false,
  evidence_url text,
  created_at timestamptz not null default now(),
  unique(user_id, team_id)
);

create index if not exists idx_player_team_affiliations_user_team
on public.player_team_affiliations(user_id, team_id);

alter table public.player_team_affiliations enable row level security;

drop policy if exists "Players can view their team affiliations" on public.player_team_affiliations;
create policy "Players can view their team affiliations"
on public.player_team_affiliations for select to authenticated
using (user_id = auth.uid() or public.is_current_user_admin_or_moderator());

drop policy if exists "Admins manage team affiliations" on public.player_team_affiliations;
create policy "Admins manage team affiliations"
on public.player_team_affiliations for all to authenticated
using (public.is_current_user_admin_or_moderator())
with check (public.is_current_user_admin_or_moderator());

create or replace function public.can_user_review_team(p_user_id uuid, p_team_id uuid)
returns boolean language sql security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.player_team_affiliations a on a.user_id = p.id
    where p.id = p_user_id
      and p.player_verified = true
      and a.team_id = p_team_id
      and a.verified = true
      and a.relationship in ('current','former')
  );
$$;

revoke all on function public.can_user_review_team(uuid, uuid) from public;
grant execute on function public.can_user_review_team(uuid, uuid) to authenticated;
