-- Allow admins/moderators to delete leagues that still have linked teams.
-- teams.league_id is ON DELETE SET NULL, so teams are retained and unlinked
-- rather than being destructively deleted.
drop function if exists public.admin_delete_directory_entry(text,uuid);

create function public.admin_delete_directory_entry(p_type text,p_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_exists boolean;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.is_current_user_admin_or_moderator() then raise exception 'Admin or moderator access required'; end if;
  if p_type not in ('coach','team','league') then raise exception 'Invalid directory type'; end if;

  if p_type='coach' then
    select exists(select 1 from public.coaches where id=p_id) into v_exists;
    if not v_exists then raise exception 'Coach not found'; end if;
    if exists(select 1 from public.reviews where coach_id=p_id) then raise exception 'Cannot delete coach with reviews. Archive it instead.'; end if;
    delete from public.coaches where id=p_id;
  elsif p_type='team' then
    select exists(select 1 from public.teams where id=p_id) into v_exists;
    if not v_exists then raise exception 'Team not found'; end if;
    if exists(select 1 from public.reviews where team_id=p_id) then raise exception 'Cannot delete team with reviews. Archive it instead.'; end if;
    delete from public.teams where id=p_id;
  else
    select exists(select 1 from public.leagues where id=p_id) into v_exists;
    if not v_exists then raise exception 'League not found'; end if;
    delete from public.leagues where id=p_id;
  end if;
  return true;
end;
$$;

revoke all on function public.admin_delete_directory_entry(text,uuid) from public,anon;
grant execute on function public.admin_delete_directory_entry(text,uuid) to authenticated;
