-- REVIEW ONLY. Not a migration. No production application without installed-schema
-- grant/role/MFA review, account deletion/export coverage and isolated acceptance.
-- Notes are not public profile content and are never included in public projections.
create schema hoopcheck_scouting_internal;
revoke all on schema hoopcheck_scouting_internal from public, anon, authenticated, service_role;
grant usage on schema hoopcheck_scouting_internal to authenticated;
create function hoopcheck_scouting_internal.can_write_notes()
returns boolean language sql stable security definer set search_path = ''
as $$
 select auth.uid() is not null
   and coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
   and exists(select 1 from public.profiles p where p.id=auth.uid()
     and p.account_type in ('agent','scout') and p.moderation_status='normal')
$$;
revoke all on function hoopcheck_scouting_internal.can_write_notes() from public, anon, authenticated, service_role;
grant execute on function hoopcheck_scouting_internal.can_write_notes() to authenticated;

create table public.private_scouting_notes (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 subject text not null check (char_length(btrim(subject)) between 1 and 100),
 body text not null check (char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index private_scouting_notes_owner_idx on public.private_scouting_notes(owner_id,created_at desc,id desc);
alter table public.private_scouting_notes enable row level security;
revoke all on public.private_scouting_notes from public, anon, authenticated, service_role;
grant select,delete on public.private_scouting_notes to authenticated;
grant insert(subject,body),update(subject,body) on public.private_scouting_notes to authenticated;
-- Former professional members retain access to their own records and can delete
-- them; only eligible current agents/scouts can create or edit. No owner transfer.
create policy "private scouting notes own read" on public.private_scouting_notes for select to authenticated
 using(owner_id=(select auth.uid()) and coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');
create policy "private scouting notes own delete" on public.private_scouting_notes for delete to authenticated
 using(owner_id=(select auth.uid()) and coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');
create policy "private scouting notes professional insert" on public.private_scouting_notes for insert to authenticated
 with check(owner_id=(select auth.uid()) and (select hoopcheck_scouting_internal.can_write_notes()));
create policy "private scouting notes professional update" on public.private_scouting_notes for update to authenticated
 using(owner_id=(select auth.uid()) and (select hoopcheck_scouting_internal.can_write_notes()))
 with check(owner_id=(select auth.uid()) and (select hoopcheck_scouting_internal.can_write_notes()));
