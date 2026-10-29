-- TP-1 follow-up: allow only approved club claimants to publish a logo for their own team.
create or replace function public.set_claimed_team_logo(
  p_team_id uuid,
  p_logo_url text,
  p_logo_bg text default 'transparent',
  p_team_table text default 'teams'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
  if p_logo_url !~ ('^https://[^/]+/storage/v1/object/public/team-logos/' || p_team_table || '/' || p_team_id::text || '/[^?]+$') then
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
$$;
revoke all on function public.set_claimed_team_logo(uuid, text, text, text) from public, anon;
grant execute on function public.set_claimed_team_logo(uuid, text, text, text) to authenticated;

drop policy if exists "Approved team claimants upload their logo" on storage.objects;
create policy "Approved team claimants upload their logo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'team-logos'
  and (storage.foldername(name))[1] in ('teams', 'womens_teams')
  and exists (
    select 1 from public.profile_claim_requests c
    where c.entity_type = 'team'
      and c.entity_id::text = (storage.foldername(name))[2]
      and c.requester_id = (select auth.uid())
      and c.status = 'approved'
  )
);
