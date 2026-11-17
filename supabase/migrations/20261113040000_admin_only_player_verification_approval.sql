-- Player verification changes trusted identity and verified affiliations.
CREATE OR REPLACE FUNCTION public.moderate_player_verification(p_request_id uuid, p_status text, p_reviewer_note text DEFAULT NULL::text)
 RETURNS player_verification_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_request public.player_verification_requests; v_now timestamptz:=now();
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.admin_roles where user_id=(select auth.uid()) and trim(lower(role)) = 'admin') then raise exception 'Only admins may approve player verification' using errcode = '42501'; end if;
 if p_status not in ('approved','rejected') then raise exception 'Invalid verification status'; end if;
 update public.player_verification_requests set status=p_status,reviewer_id=auth.uid(),reviewer_note=case when p_reviewer_note is null then reviewer_note else left(trim(p_reviewer_note),1000) end,reviewed_at=v_now where id=p_request_id and status='pending' returning * into v_request;
 if v_request.id is null then raise exception 'Pending verification request not found'; end if;
 update public.profiles set player_verified=(p_status='approved'),player_verified_at=case when p_status='approved' then v_now else null end,
 selected_team_id=case when p_status='approved' then v_request.team_id else selected_team_id end,
 selected_womens_team_id=case when p_status='approved' then v_request.womens_team_id else selected_womens_team_id end,
 selected_team_verified=case when p_status='approved' and (v_request.team_id is not null or v_request.womens_team_id is not null) then true else selected_team_verified end
 where id=v_request.user_id;
 if p_status='approved' and v_request.team_id is not null then
  insert into public.player_team_affiliations(user_id,team_id,relationship,start_date,verified,evidence_url) values(v_request.user_id,v_request.team_id,'current',current_date,true,v_request.evidence_url)
  on conflict(user_id,team_id) do update set relationship='current',verified=true,evidence_url=excluded.evidence_url,end_date=null;
 end if;
 return v_request;
end; $function$;

revoke all on function public.moderate_player_verification(uuid,text,text) from public,anon;
grant execute on function public.moderate_player_verification(uuid,text,text) to authenticated,service_role;
