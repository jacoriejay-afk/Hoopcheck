-- Prevent externally hosted URLs from being registered as verified team logos.
CREATE OR REPLACE FUNCTION public.set_claimed_team_logo(p_team_id uuid, p_logo_url text, p_logo_bg text DEFAULT 'transparent'::text, p_team_table text DEFAULT 'teams'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_logo_bg not in ('transparent', 'light', 'dark') then
    raise exception 'Invalid logo background';
  end if;
  if p_team_table not in ('teams', 'womens_teams') then
    raise exception 'Invalid team table';
  end if;
  if p_logo_url is null or p_logo_url !~ ('^https://ucbdceaieyenljcwlhnj[.]supabase[.]co/storage/v1/object/public/team-logos/' || p_team_table || '/' || p_team_id::text || '/[^?]+$') then
    raise exception 'Logo must be stored in this team''s HoopCheck Storage path';
  end if;
  if not exists (
    select 1 from public.profile_claim_requests c
    where c.entity_type = 'team'
      and c.entity_id = p_team_id
      and c.requester_id = auth.uid()
      and c.status = 'approved'
  ) then
    raise exception 'An approved claim for this team is required';
  end if;
  if p_team_table = 'teams' then
    update public.teams set logo_url = p_logo_url, logo_bg = p_logo_bg where id = p_team_id;
  else
    update public.womens_teams set logo_url = p_logo_url, logo_bg = p_logo_bg where id = p_team_id;
  end if;
  if not found then raise exception 'Team not found'; end if;
end;
$function$;
