create or replace function public.admin_delete_directory_entry(p_type text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  review_count integer;
  team_count integer;
  coach_count integer;
  deleted boolean := false;
begin
  if not public.is_current_user_admin_or_moderator() then
    raise exception 'Admin or moderator access required';
  end if;

  if p_type='coach' then
    select count(*) into review_count from public.reviews where coach_id=p_id;
    if review_count>0 then raise exception 'Cannot delete coach with existing reviews. Deactivate it instead.'; end if;
    delete from public.coaches where id=p_id;
    deleted:=found;
  elsif p_type='team' then
    select count(*) into review_count from public.reviews where team_id=p_id;
    if review_count>0 then raise exception 'Cannot delete team with existing reviews. Deactivate it instead.'; end if;
    select count(*) into coach_count from public.coaches where current_team_id=p_id;
    if coach_count>0 then raise exception 'Cannot delete team with linked coaches. Unlink them first.'; end if;
    delete from public.teams where id=p_id;
    deleted:=found;
  elsif p_type='league' then
    select count(*) into review_count from public.reviews where league_id=p_id;
    if review_count>0 then raise exception 'Cannot delete league with existing reviews. Deactivate it instead.'; end if;
    select count(*) into team_count from public.teams where league_id=p_id;
    if team_count>0 then raise exception 'Cannot delete league with linked teams. Unlink them first.'; end if;
    delete from public.leagues where id=p_id;
    deleted:=found;
  else
    raise exception 'Unsupported directory type';
  end if;

  return jsonb_build_object('deleted',deleted,'type',p_type,'id',p_id);
end;
$$;

revoke all on function public.admin_delete_directory_entry(text,uuid) from public;
grant execute on function public.admin_delete_directory_entry(text,uuid) to authenticated;
