-- TM-3: roster board and append-only audit groundwork. No Wire events until WIRE-1 integration.
create table if not exists public.club_roster_entries (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 player_id uuid references public.profiles(id) on delete set null,
 player_name text not null check (char_length(trim(player_name)) between 2 and 120),
 position text check (position is null or char_length(position)<=60),
 jersey_number integer check (jersey_number between 0 and 99),
 season text,
 status text not null default 'active' check (status in ('active','departed')),
 dispute_status text not null default 'none' check (dispute_status in ('none','pending','resolved','rejected')),
 club_confirmed_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 updated_by uuid not null references public.profiles(id)
);
create index if not exists club_roster_entries_team_idx on public.club_roster_entries(team_id,status);
alter table public.club_roster_entries enable row level security;
grant select,insert on public.club_roster_entries to authenticated;
-- Managers may edit club-confirmed fields, but never identity, club ownership or dispute state.
grant update (player_name,position,jersey_number,season,status,club_confirmed_at,updated_at,updated_by) on public.club_roster_entries to authenticated;
grant select on public.club_roster_entries to anon;
create policy "public roster entries" on public.club_roster_entries for select to anon,authenticated using (true);
create policy "approved club managers insert roster" on public.club_roster_entries for insert to authenticated
with check (updated_by=(select auth.uid()) and exists (
 select 1 from public.profile_claim_requests c where c.entity_type='team' and c.entity_id=team_id and c.requester_id=(select auth.uid()) and c.status='approved'
));
create policy "approved club managers edit roster" on public.club_roster_entries for update to authenticated
using (exists (
 select 1 from public.profile_claim_requests c where c.entity_type='team' and c.entity_id=team_id and c.requester_id=(select auth.uid()) and c.status='approved'
))
with check (updated_by=(select auth.uid()) and exists (
 select 1 from public.profile_claim_requests c where c.entity_type='team' and c.entity_id=team_id and c.requester_id=(select auth.uid()) and c.status='approved'
));
create table if not exists public.club_roster_change_log (
 id bigint generated always as identity primary key,
 entry_id uuid not null,
 team_id uuid not null references public.teams(id),
 actor_id uuid references public.profiles(id),
 action text not null,
 before_data jsonb,
 after_data jsonb,
 changed_at timestamptz not null default now()
);
alter table public.club_roster_change_log enable row level security;
grant select on public.club_roster_change_log to authenticated;
create policy "club managers read roster audit" on public.club_roster_change_log for select to authenticated
using (exists (
 select 1 from public.profile_claim_requests c where c.entity_type='team' and c.entity_id=team_id and c.requester_id=(select auth.uid()) and c.status='approved'
));
create or replace function public.audit_club_roster_change()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 insert into public.club_roster_change_log(entry_id,team_id,actor_id,action,before_data,after_data)
 values(new.id,new.team_id,auth.uid(),tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function public.audit_club_roster_change() from public,anon,authenticated;
drop trigger if exists club_roster_audit on public.club_roster_entries;
create trigger club_roster_audit after insert or update on public.club_roster_entries
for each row execute function public.audit_club_roster_change();

-- Server-side invariant: the client cannot forge a confirmation timestamp or modify
-- identity, ownership or dispute fields, even through a crafted REST request.
create or replace function public.guard_club_roster_edit()
returns trigger language plpgsql set search_path=public
as $$
begin
 if tg_op='UPDATE' then
   if new.team_id is distinct from old.team_id or new.player_id is distinct from old.player_id
      or new.dispute_status is distinct from old.dispute_status then
     raise exception 'Roster ownership, linked player and dispute status are protected';
   end if;
 end if;
 new.updated_by := auth.uid();
 if new.updated_by is null then raise exception 'Authenticated manager required'; end if;
 new.updated_at := now();
 new.club_confirmed_at := now();
 return new;
end $$;
drop trigger if exists club_roster_guard on public.club_roster_entries;
create trigger club_roster_guard before insert or update on public.club_roster_entries
for each row execute function public.guard_club_roster_edit();
