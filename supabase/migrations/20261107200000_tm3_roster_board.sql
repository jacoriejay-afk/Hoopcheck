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
grant select on public.club_roster_entries to authenticated;
-- Managers can add name-only entries; profile linking needs a verified consent flow.
grant insert (team_id,player_name,position,jersey_number,season,status,updated_by) on public.club_roster_entries to authenticated;
-- The authenticated role cannot directly mutate dispute status.
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
 if tg_op='INSERT' and new.player_id is not null then
   raise exception 'Profile linking requires verified player consent';
 end if;
 if tg_op='UPDATE' then
   if new.team_id is distinct from old.team_id or new.player_id is distinct from old.player_id
      then
     raise exception 'Roster ownership, linked player and dispute status are protected';
   end if;
   if new.dispute_status is distinct from old.dispute_status then
     -- Only the linked player may open a dispute. Resolution is reserved
     -- for a separate audited moderator operation.
     if (not (new.dispute_status='pending' and old.player_id=auth.uid())
         and not (new.dispute_status in ('resolved','rejected') and private.is_admin_or_moderator()))
        or new.player_name is distinct from old.player_name
        or new.position is distinct from old.position
        or new.jersey_number is distinct from old.jersey_number
        or new.season is distinct from old.season
        or new.status is distinct from old.status then
       raise exception 'Dispute status is protected';
     end if;
   end if;
   if new.dispute_status is distinct from old.dispute_status then
     new.club_confirmed_at := old.club_confirmed_at;
     new.updated_by := old.updated_by;
     new.updated_at := old.updated_at;
     return new;
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

-- Player disputes are handled by a narrow RPC, not a broad UPDATE grant.
create table if not exists public.club_roster_disputes (
 id uuid primary key default gen_random_uuid(),
 entry_id uuid not null references public.club_roster_entries(id) on delete cascade,
 team_id uuid not null references public.teams(id),
 player_id uuid not null references public.profiles(id),
 reason text not null check (char_length(trim(reason)) between 10 and 1000),
 status text not null default 'pending' check (status in ('pending','resolved','rejected')),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 resolved_by uuid references public.profiles(id)
);
create unique index if not exists club_roster_one_open_dispute on public.club_roster_disputes(entry_id) where status='pending';
alter table public.club_roster_disputes enable row level security;
grant select on public.club_roster_disputes to authenticated;
create policy "player sees own roster dispute" on public.club_roster_disputes for select to authenticated
using (player_id=(select auth.uid()));
create policy "club manager sees roster disputes" on public.club_roster_disputes for select to authenticated
using (exists (select 1 from public.profile_claim_requests c where c.entity_type='team' and c.entity_id=team_id and c.requester_id=(select auth.uid()) and c.status='approved'));

create policy "moderators read roster disputes" on public.club_roster_disputes for select to authenticated
using (private.is_admin_or_moderator());
create policy "moderators read roster audit" on public.club_roster_change_log for select to authenticated
using (private.is_admin_or_moderator());

-- A dispute can be filed only by the profile directly linked to the entry.
-- Unlinked name-only entries require identity verification by moderation.
create or replace function public.dispute_my_club_roster_entry(p_entry_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_entry public.club_roster_entries%rowtype; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if char_length(trim(coalesce(p_reason,''))) not between 10 and 1000 then raise exception 'Reason must be 10-1000 characters'; end if;
 select * into v_entry from public.club_roster_entries where id=p_entry_id for update;
 if not found or v_entry.player_id is distinct from auth.uid() then raise exception 'Roster entry not linked to your profile'; end if;
 if v_entry.dispute_status='pending' then raise exception 'Entry already disputed'; end if;
 insert into public.club_roster_disputes(entry_id,team_id,player_id,reason)
 values(v_entry.id,v_entry.team_id,auth.uid(),trim(p_reason)) returning id into v_id;
 -- Direct field update here bypasses the authenticated column grant.
 -- The security-definer function can update protected columns, but the
 -- guard trigger still verifies the linked player's identity.
 update public.club_roster_entries set dispute_status='pending' where id=v_entry.id;
 return v_id;
end $$;
revoke all on function public.dispute_my_club_roster_entry(uuid,text) from public,anon;
grant execute on function public.dispute_my_club_roster_entry(uuid,text) to authenticated;

-- Moderators close a dispute atomically; managers cannot call this RPC.
create or replace function public.resolve_club_roster_dispute(p_dispute_id uuid,p_resolution text)
returns void language plpgsql security definer set search_path=public
as $$
declare v_dispute public.club_roster_disputes%rowtype;
begin
 if auth.uid() is null or not private.is_admin_or_moderator() then
   raise exception 'HoopCheck moderation only';
 end if;
 if p_resolution not in ('resolved','rejected') then
   raise exception 'Invalid resolution';
 end if;
 select * into v_dispute from public.club_roster_disputes where id=p_dispute_id for update;
 if not found or v_dispute.status <> 'pending' then
   raise exception 'No pending dispute found';
 end if;
 update public.club_roster_disputes
 set status=p_resolution,resolved_by=auth.uid(),resolved_at=now()
 where id=v_dispute.id;
 update public.club_roster_entries set dispute_status=p_resolution where id=v_dispute.entry_id;
end $$;
revoke all on function public.resolve_club_roster_dispute(uuid,text) from public,anon;
grant execute on function public.resolve_club_roster_dispute(uuid,text) to authenticated;
