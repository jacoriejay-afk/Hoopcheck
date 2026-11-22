-- REVIEW CANDIDATE v2; TEST DATABASE ONLY until explicitly approved.
-- Requires hoopgroups_channels_v1_review_only.sql first.
-- Preserves existing Team Fan Groups, moderator-only approval and all v1 RLS policies.
begin;

alter table public.hoop_group_spaces
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists accent_color text not null default 'orange',
  add column if not exists icon_key text not null default 'basketball';

alter table public.hoop_group_spaces
  add constraint hoop_group_spaces_accent_color_check
  check (accent_color in ('orange','blue','purple','green','pink','gold'));
alter table public.hoop_group_spaces
  add constraint hoop_group_spaces_icon_key_check
  check (icon_key in ('basketball','flame','globe','star','trophy','users'));

create index if not exists hoop_group_spaces_owner_idx on public.hoop_group_spaces(owner_id);

-- An authenticated person may make up to three communities, owns only those
-- spaces, and cannot reassign their owner or mutate official seeded spaces.
create policy hoop_group_spaces_create_owned
  on public.hoop_group_spaces for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select count(*) from public.hoop_group_spaces
         where owner_id = (select auth.uid())) < 3
  );
create policy hoop_group_spaces_edit_owned
  on public.hoop_group_spaces for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Only group owners can create and rename channels. No client deletes: keep
-- message retention and moderation records intact.
create policy hoop_group_channels_create_owned
  on public.hoop_group_channels for insert to authenticated
  with check (
    exists(select 1 from public.hoop_group_spaces s
      where s.id=space_id and s.owner_id=(select auth.uid()))
    and (select count(*) from public.hoop_group_channels c
      where c.space_id=hoop_group_channels.space_id) < 12
  );
create policy hoop_group_channels_rename_owned
  on public.hoop_group_channels for update to authenticated
  using (exists(select 1 from public.hoop_group_spaces s
    where s.id=space_id and s.owner_id=(select auth.uid())))
  with check (exists(select 1 from public.hoop_group_spaces s
    where s.id=space_id and s.owner_id=(select auth.uid())));

-- Column-limited privileges prevent editing owner_id/slug/category or channel
-- routing, even if a client bypasses the UI and calls PostgREST directly.
revoke all on public.hoop_group_spaces from authenticated;
grant select on public.hoop_group_spaces to authenticated;
grant insert(slug,name,description,category,owner_id,accent_color,icon_key)
  on public.hoop_group_spaces to authenticated;
grant update(name,description,accent_color,icon_key)
  on public.hoop_group_spaces to authenticated;

revoke all on public.hoop_group_channels from authenticated;
grant select on public.hoop_group_channels to authenticated;
grant insert(space_id,slug,name,sort_index) on public.hoop_group_channels to authenticated;
grant update(name) on public.hoop_group_channels to authenticated;

-- Fully transactional setup: if the auto-join or initial channel inserts fail,
-- the entire owner-created space INSERT fails, leaving no orphaned community.
create or replace function public.hoop_group_create_defaults()
returns trigger
language plpgsql security invoker set search_path = ''
as $hoopgroup_defaults$
begin
  if new.owner_id is not null then
    insert into public.hoop_group_members(space_id,user_id)
    values (new.id,new.owner_id);

    insert into public.hoop_group_channels(space_id,slug,name,sort_index)
    values (new.id,'welcome','welcome',0),
           (new.id,'general','general',1),
           (new.id,'game-talk','game-talk',2);
  end if;
  return new;
end;
$hoopgroup_defaults$;

revoke all on function public.hoop_group_create_defaults() from public,anon,authenticated;
drop trigger if exists hoop_group_spaces_defaults_insert on public.hoop_group_spaces;
create trigger hoop_group_spaces_defaults_insert
after insert on public.hoop_group_spaces
for each row execute function public.hoop_group_create_defaults();

commit;
