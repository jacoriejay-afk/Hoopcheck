-- HoopCheck production security hardening
-- Atomic player verification moderation and server-side review validation support.

create or replace function private.moderate_player_verification(
  p_request_id uuid,
  p_status text,
  p_reviewer_note text default null
)
returns public.player_verification_requests
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_request public.player_verification_requests;
  v_now timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.admin_roles
    where user_id=(select auth.uid())
      and trim(lower(role)) in ('admin','moderator')
  ) then
    raise exception 'Admin or moderator access required';
  end if;

  if p_status not in ('approved','rejected') then
    raise exception 'Invalid verification status';
  end if;

  update public.player_verification_requests
  set status=p_status,
      reviewer_id=(select auth.uid()),
      reviewer_note=case when p_reviewer_note is null then reviewer_note else left(trim(p_reviewer_note),1000) end,
      reviewed_at=v_now
  where id=p_request_id
    and status='pending'
  returning * into v_request;

  if v_request.id is null then
    raise exception 'Pending verification request not found';
  end if;

  update public.profiles
  set player_verified=(p_status='approved'),
      player_verified_at=case when p_status='approved' then v_now else null end
  where id=v_request.user_id;

  return v_request;
end;
$$;

revoke all on function private.moderate_player_verification(uuid,text,text) from public,anon,authenticated;
grant usage on schema private to authenticated;

create or replace function public.moderate_player_verification(
  p_request_id uuid,
  p_status text,
  p_reviewer_note text default null
)
returns public.player_verification_requests
language sql
volatile
security invoker
set search_path=public,pg_catalog
as $$
  select * from private.moderate_player_verification(p_request_id,p_status,p_reviewer_note);
$$;

revoke all on function public.moderate_player_verification(uuid,text,text) from public,anon;
grant execute on function public.moderate_player_verification(uuid,text,text) to authenticated;