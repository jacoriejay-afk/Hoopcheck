-- SECURITY-FINAL: non-destructive RPC authorization regression checks.
-- Run in a transaction against a database with the HoopCheck schema.
-- No user records are created or modified.
begin;
set local role anon;
do $$
declare
  v_unknown uuid := '00000000-0000-0000-0000-000000000000';
begin
  if (select count(*) from public.get_public_follow_list('followers','player',v_unknown,null)) <> 0 then
    raise exception 'Anonymous caller saw unknown profile followers';
  end if;
  if (select count(*) from public.get_public_follow_list('following',null,null,v_unknown)) <> 0 then
    raise exception 'Anonymous caller saw unknown profile following';
  end if;
  if public.get_public_following_count(v_unknown) <> 0 then
    raise exception 'Anonymous caller saw unknown profile following count';
  end if;
  if public.is_username_available('bad username!') then
    raise exception 'Invalid username was accepted';
  end if;
  if public.is_team_profile_claimed(v_unknown,'teams') then
    raise exception 'Unknown team was marked claimed';
  end if;
end $$;
rollback;

begin;
set local role authenticated;
do $$
declare
  v_unknown uuid := '00000000-0000-0000-0000-000000000000';
begin
  begin
    perform public.admin_set_membership(v_unknown,'premium');
    raise exception 'Unauthenticated session granted membership';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.admin_delete_directory_entry('team',v_unknown);
    raise exception 'Unauthenticated session deleted directory entry';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.admin_set_user_role(v_unknown,'admin');
    raise exception 'Unauthenticated session granted admin role';
  exception when sqlstate '42501' then null;
  end;
end $$;
rollback;
